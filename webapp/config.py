import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")  # no-op if .env doesn't exist yet — fine for first-time setup

DB_PATH = BASE_DIR / "data" / "processed" / "foodpanda.duckdb"
STATIC_DATA_DIR = BASE_DIR / "data" / "processed" / "static"

# ---- sentiment model config ----
MODEL_GENERAL = "cardiffnlp/twitter-xlm-roberta-base-sentiment"
MODEL_ROMAN_URDU = "Khubaib01/roman-urdu-sentiment-xlm-r"

# "local" = load both transformer models into this process's own memory (needs ~2.5GB RAM,
#           works with no internet after the first download, best for local dev/demo)
# "api"   = call the Hugging Face Inference API instead (near-zero RAM, needs HF_TOKEN env var
#           and internet at request time — better fit for a free-tier hosting plan with limited RAM)
SENTIMENT_MODE = os.environ.get("SENTIMENT_MODE", "local")
HF_TOKEN = os.environ.get("HF_TOKEN", "")

# ---- owner AI assistant (Groq) config ----
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
# Verify this against https://console.groq.com/docs/models before deploying — Groq's model
# lineup has been rotating throughout 2026 (llama-3.1-8b-instant and llama-3.3-70b-versatile
# both got deprecation notices; openai/gpt-oss-120b is their current recommended migration
# target). Don't trust this hardcoded value blindly — check the console.
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")

MIN_REVIEWS_FOR_CITY_HIGHLIGHT = 100
MIN_MENTIONS_FOR_ASPECT = 3

APP_DISCLAIMER = (
    "Independent student research project analyzing publicly available Foodpanda review data. "
    "Not affiliated with, sponsored by, or endorsed by Foodpanda."
)
