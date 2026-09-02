"""
Live sentiment prediction for the website's "try it yourself" tester.

Deliberately mirrors the actual Kaggle pipeline's logic (Sections 3, 5, 6b/6c-6d, 7 of the
notebook) rather than a simplified reimplementation — the whole point of showing this on the
site is "this is the same method that produced the dataset," so it has to actually be the same
method: same two models, same label normalization, same language-based routing.

Two modes (config.SENTIMENT_MODE):
  "local" — loads both models into this process via transformers. ~2.5GB RAM once warmed up.
            Reliable, this is the pattern already validated in the notebook. Default.
  "api"   — calls Hugging Face's Inference Providers via huggingface_hub.InferenceClient instead
            of loading model weights locally. Much lower RAM, good fit for a constrained free
            hosting tier. IMPORTANT CAVEAT: unlike well-known models, small community fine-tunes
            like Khubaib01/roman-urdu-sentiment-xlm-r are NOT guaranteed to be hosted by any
            Inference Provider. Test this mode after deploying, before relying on it for a live
            demo — if it 404s, fall back to "local" mode (needs more RAM but always works).
"""
import re
from functools import lru_cache

import config

CANONICAL_LABELS = {"negative", "neutral", "positive"}

# Same heuristic as Section 5 of the notebook — see that notebook's markdown for why this is
# used instead of a language-ID library (Roman Urdu isn't a language those recognize).
URDU_SCRIPT_RE = re.compile(r"[\u0600-\u06FF]")
ROMAN_URDU_MARKERS = {
    "acha", "achi", "ache", "bohat", "bohot", "boht", "bht", "hai", "hain", "tha", "thi", "thy",
    "nahi", "nhi", "kam", "zyada", "ziada", "bilkul", "sath", "bhi", "mein", "main", "liya",
    "diya", "gaya", "gai", "wala", "wali", "kya", "koi", "kuch", "ka", "ki", "ke", "se", "ko",
    "aur", "zabardast", "mazedar", "lazeez", "behtreen",
}


def normalize_label(raw_label: str) -> str:
    l = str(raw_label).strip().lower()
    if l not in CANONICAL_LABELS:
        raise ValueError(f"Unrecognized sentiment label: {raw_label!r}")
    return l


def language_flag(text: str) -> str:
    if URDU_SCRIPT_RE.search(text):
        return "urdu_script"
    tokens = set(re.findall(r"[a-z]+", text.lower()))
    if tokens & ROMAN_URDU_MARKERS:
        return "roman_urdu_mixed"
    return "english_or_other"


# ---------------------------------------------------------------------------
# LOCAL MODE
# ---------------------------------------------------------------------------
class _LocalModels:
    """Lazy-loaded singleton so the models only load once, on first request, not at import
    time — keeps `flask run` fast to start and avoids loading ~2.5GB before we know the app
    is actually being used for the tester."""
    _general = None
    _roman_urdu = None

    @classmethod
    def get_general(cls):
        if cls._general is None:
            import torch
            from transformers import AutoTokenizer, AutoModelForSequenceClassification
            tok = AutoTokenizer.from_pretrained(config.MODEL_GENERAL)
            model = AutoModelForSequenceClassification.from_pretrained(config.MODEL_GENERAL).eval()
            cls._general = (tok, model, model.config.id2label)
        return cls._general

    @classmethod
    def get_roman_urdu(cls):
        if cls._roman_urdu is None:
            import torch
            from transformers import AutoTokenizer, AutoModelForSequenceClassification
            tok = AutoTokenizer.from_pretrained(config.MODEL_ROMAN_URDU)
            model = AutoModelForSequenceClassification.from_pretrained(config.MODEL_ROMAN_URDU).eval()
            cls._roman_urdu = (tok, model, model.config.id2label)
        return cls._roman_urdu


def _predict_local(text: str, tokenizer, model, id2label) -> tuple[str, float, dict]:
    import torch
    enc = tokenizer([text], return_tensors="pt", truncation=True, max_length=64)
    with torch.no_grad():
        probs = torch.softmax(model(**enc).logits, dim=-1).cpu().numpy()[0]
    scores = {normalize_label(id2label[i]): float(probs[i]) for i in range(len(probs))}
    pred_label = max(scores, key=scores.get)
    return pred_label, scores[pred_label], scores


# ---------------------------------------------------------------------------
# API MODE
# ---------------------------------------------------------------------------
@lru_cache(maxsize=1)
def _get_inference_client():
    from huggingface_hub import InferenceClient
    if not config.HF_TOKEN:
        raise RuntimeError("SENTIMENT_MODE=api requires HF_TOKEN to be set in the environment.")
    return InferenceClient(token=config.HF_TOKEN)


def _predict_api(text: str, model_id: str) -> tuple[str, float, dict]:
    client = _get_inference_client()
    try:
        result = client.text_classification(text=text, model=model_id)
    except Exception as e:
        raise RuntimeError(
            f"Hugging Face Inference API call failed for model '{model_id}': {e}. "
            f"Community fine-tunes aren't always hosted by an Inference Provider — "
            f"if this keeps happening, switch SENTIMENT_MODE to 'local' instead."
        ) from e
    scores = {normalize_label(item.label): float(item.score) for item in result}
    pred_label = max(scores, key=scores.get)
    return pred_label, scores[pred_label], scores


# ---------------------------------------------------------------------------
# PUBLIC API
# ---------------------------------------------------------------------------
def analyze(text: str) -> dict:
    """Run both models, route to the appropriate one as primary based on language (same logic
    as the notebook's Section 7), and return a full breakdown for the UI to show both models'
    opinions, not just the final answer — good for the 'this is a real ensemble' demo moment."""
    text = (text or "").strip()
    if not text:
        raise ValueError("Empty text")

    lang = language_flag(text)

    if config.SENTIMENT_MODE == "local":
        tok_g, model_g, id2label_g = _LocalModels.get_general()
        tok_r, model_r, id2label_r = _LocalModels.get_roman_urdu()
        label_g, conf_g, scores_g = _predict_local(text, tok_g, model_g, id2label_g)
        label_r, conf_r, scores_r = _predict_local(text, tok_r, model_r, id2label_r)
    else:
        label_g, conf_g, scores_g = _predict_api(text, config.MODEL_GENERAL)
        label_r, conf_r, scores_r = _predict_api(text, config.MODEL_ROMAN_URDU)

    if lang == "roman_urdu_mixed":
        primary_label, primary_conf, primary_scores = label_r, conf_r, scores_r
        primary_model = "Khubaib01 (Roman Urdu specialist)"
    else:
        primary_label, primary_conf, primary_scores = label_g, conf_g, scores_g
        primary_model = "cardiffnlp (general multilingual)"

    return {
        "text": text,
        "detected_language": lang,
        "sentiment": primary_label,
        "confidence": round(primary_conf, 4),
        "primary_model": primary_model,
        "models_agree": label_g == label_r,
        "breakdown": {
            "general_model": {"label": label_g, "confidence": round(conf_g, 4), "scores": scores_g},
            "roman_urdu_model": {"label": label_r, "confidence": round(conf_r, 4), "scores": scores_r},
        },
    }
