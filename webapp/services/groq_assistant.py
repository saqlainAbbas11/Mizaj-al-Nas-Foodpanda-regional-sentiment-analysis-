"""
Owner-side AI assistant. Deliberately NOT a free-form chatbot — every response is grounded in
the specific restaurant's real, precomputed stats pulled from the database, injected into the
system prompt. This matters for credibility: an owner asking "why are people complaining" should
get an answer traceable to actual review data, not a plausible-sounding hallucination.
"""
import json
from groq import Groq

import config
from services import db

SYSTEM_PROMPT_TEMPLATE = """You are an assistant helping a restaurant owner on Foodpanda \
understand their customer reviews. You are NOT a general chatbot — you only discuss the data \
provided below, which was computed from the owner's actual reviews by a sentiment analysis \
pipeline (two transformer models, cross-validated on labeled benchmarks; see the site's \
Methodology page for details the owner can be pointed to if they ask how this was measured).

RESTAURANT: {restaurant_name} ({city})
Total reviews analyzed: {review_count}
Sentiment breakdown: {pct_positive:.1f}% positive, {pct_neutral:.1f}% neutral, {pct_negative:.1f}% negative

Aspect breakdown (only aspects with enough mentions to be statistically meaningful are shown; \
"reliable" means at least 3 mentions):
{aspect_table}

Sample negative reviews (for concrete examples, not the full picture):
{sample_negative_reviews}

Sample positive reviews:
{sample_positive_reviews}

Rules:
- Only make claims that are supported by the numbers above. If asked something the data doesn't \
cover, say so plainly instead of guessing.
- When you recommend an action, tie it explicitly to a specific number above (e.g. "your hygiene \
mentions are 80% negative, worth investigating X" — not generic restaurant advice).
- Keep responses focused and actionable — the owner is busy, not looking for an essay.
- If the review count for this restaurant is small, say the confidence in these conclusions is \
correspondingly lower, rather than stating everything with false certainty.
"""


def _get_restaurant_context(storeid: str) -> dict:
    resto_rows = db.query_records(
        "SELECT * FROM restaurant_summary WHERE storeid = ?", [storeid]
    )
    if not resto_rows:
        raise ValueError(f"No restaurant found with storeid={storeid}")
    resto = resto_rows[0]

    aspects = db.query_records(
        """SELECT aspect, mentions, ROUND(pct_negative, 1) AS pct_negative,
                  ROUND(pct_positive, 1) AS pct_positive, reliable_sample
           FROM restaurant_aspect_summary
           WHERE storeid = ? AND reliable_sample = true
           ORDER BY pct_negative DESC""",
        [storeid],
    )

    neg_samples = db.query_records(
        """SELECT text FROM processed_reviews
           WHERE storeid = ? AND sentiment_final = 'negative'
           ORDER BY RANDOM() LIMIT 5""",
        [storeid],
    )
    pos_samples = db.query_records(
        """SELECT text FROM processed_reviews
           WHERE storeid = ? AND sentiment_final = 'positive'
           ORDER BY RANDOM() LIMIT 5""",
        [storeid],
    )

    return {
        "restaurant_name": resto.get("completestorename", "Unknown"),
        "city": resto.get("city", "Unknown"),
        "review_count": resto.get("review_count", 0),
        "pct_positive": resto.get("pct_positive", 0),
        "pct_neutral": resto.get("pct_neutral", 0),
        "pct_negative": resto.get("pct_negative", 0),
        "aspects": aspects,
        "neg_samples": [r["text"] for r in neg_samples],
        "pos_samples": [r["text"] for r in pos_samples],
    }


def _build_system_prompt(ctx: dict) -> str:
    if ctx["aspects"]:
        aspect_table = "\n".join(
            f"  - {a['aspect']}: {a['mentions']} mentions, {a['pct_negative']}% negative, "
            f"{a['pct_positive']}% positive"
            for a in ctx["aspects"]
        )
    else:
        aspect_table = "  (not enough reviews yet for a reliable aspect breakdown)"

    neg_text = "\n".join(f'  - "{t}"' for t in ctx["neg_samples"]) or "  (none available)"
    pos_text = "\n".join(f'  - "{t}"' for t in ctx["pos_samples"]) or "  (none available)"

    return SYSTEM_PROMPT_TEMPLATE.format(
        restaurant_name=ctx["restaurant_name"],
        city=ctx["city"],
        review_count=ctx["review_count"],
        pct_positive=ctx["pct_positive"],
        pct_neutral=ctx["pct_neutral"],
        pct_negative=ctx["pct_negative"],
        aspect_table=aspect_table,
        sample_negative_reviews=neg_text,
        sample_positive_reviews=pos_text,
    )


def chat(storeid: str, user_message: str, history: list[dict] | None = None) -> dict:
    """`history` is a list of {"role": "user"|"assistant", "content": str}, NOT including the
    system prompt — that's rebuilt fresh each call so it always reflects current data rather
    than being baked into a stored conversation."""
    if not config.GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set in the environment.")

    ctx = _get_restaurant_context(storeid)
    system_prompt = _build_system_prompt(ctx)

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history or [])
    messages.append({"role": "user", "content": user_message})

    client = Groq(api_key=config.GROQ_API_KEY)
    completion = client.chat.completions.create(
        messages=messages,
        model=config.GROQ_MODEL,
        temperature=0.3,  # low — this should read as grounded analysis, not creative writing
        max_completion_tokens=1500,
    )
    reply = completion.choices[0].message.content

    return {
        "reply": reply,
        "restaurant_name": ctx["restaurant_name"],
        "grounded_in": {
            "review_count": ctx["review_count"],
            "aspect_count": len(ctx["aspects"]),
        },
    }
