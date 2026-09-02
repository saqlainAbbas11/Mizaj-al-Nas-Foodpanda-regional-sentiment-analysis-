# Mizaj al-Nas — مزاج الناس

**The Sentiment of the People** — a regional review sentiment analysis platform for Foodpanda restaurant reviews across Pakistan.

Analyze 1.55 million reviews across 16,000+ restaurants in 27 cities. Explore city-level sentiment trends, aspect breakdowns, restaurant rankings, and drill down to individual review quotes — all through an interactive web dashboard with an AI-powered owner assistant and live sentiment tester.

## Live Demo

[Deployed on Render](https://mizaj-al-nas.onrender.com) *(update this URL after deploying)*

## Features

- **Interactive Dashboard** — city-level sentiment maps, aspect heatmaps, temporal trends
- **Restaurant Search** — search and paginate across 16,000+ restaurants with sentiment scores
- **Restaurant Detail** — per-aspect breakdown with corrected ranking (rate-based, not volume-based), sample review quotes
- **Owner Portal** — AI-powered assistant grounded in real per-restaurant stats, generates actionable improvement strategies
- **Live Sentiment Tester** — type any review text (English or Roman Urdu) and get real-time ensemble predictions
- **Methodology Page** — benchmark results, BERTopic-discovered topics, zero-shot aspect discovery, temporal trends, city reliability scores
- **Responsive Design** — fully mobile-friendly with Tailwind CSS

## Architecture

```
Browser
  ↓
Flask (Gunicorn on Render)
  ↓
DuckDB (read-only analytical DB, rebuilt from CSVs on deploy)
  ├── restaurant_summary      — 16K restaurants with sentiment stats
  ├── processed_reviews        — 207K sample reviews (5/sentiment/restaurant)
  ├── restaurant_aspect_summary — 61K aspect rows with corrected ranking
  └── city/aspect/trend data  — static JSON for methodology pages

AI features (API-based on hosting)
  ├── Groq LLM — owner assistant (restaurant-grounded strategies)
  └── HuggingFace Inference API — live sentiment tester
```

## Tech Stack

- **Backend**: Python, Flask, DuckDB, Pandas
- **Frontend**: Tailwind CSS (CDN), Chart.js, vanilla JS
- **AI/ML**: HuggingFace Transformers (local), Groq LLM API (hosting), SentencePiece
- **Hosting**: Render.com (free tier), Gunicorn
- **Data**: 1.55M Foodpanda reviews, 27 cities, 7 aspect categories

## Project Structure

```
banoQabil/
├── render.yaml                    # Render.com one-click deploy config
├── ide.txt                        # Architecture review notes
│
└── webapp/
    ├── app.py                     # Flask routes (pages + JSON API)
    ├── config.py                  # Env-driven config
    ├── requirements.txt           # Full local dev deps (includes torch/transformers)
    ├── requirements-hosting.txt   # Lightweight hosting deps (no torch)
    ├── .env.example               # Template for secrets
    ├── .gitignore
    │
    ├── services/
    │   ├── db.py                  # DuckDB connection + static JSON loader
    │   ├── province_mapping.py    # Pakistan city → province lookup
    │   ├── sentiment_model.py     # Ensemble sentiment (local + API modes)
    │   └── groq_assistant.py      # Owner AI assistant
    │
    ├── scripts/
    │   ├── build_database.py           # Full local DB build (all 12 CSVs)
    │   ├── build_database_hosting.py   # Lightweight hosting DB build
    │   └── extract_sample_reviews.py   # Generate sample_reviews.csv from full dataset
    │
    ├── data/
    │   ├── raw/                   # Source CSVs (2 large ones gitignored)
    │   └── processed/             # DuckDB + static JSON (rebuilt on deploy)
    │
    ├── templates/                 # Jinja2 HTML templates
    │   ├── base.html              # Layout, navbar (Arabic logo), footer
    │   ├── landing.html           # Homepage with hero + stats
    │   ├── user.html              # City explorer
    │   ├── restaurant_detail.html # Restaurant drill-down
    │   ├── owner_search.html      # Owner portal search
    │   ├── owner_dashboard.html   # Owner AI dashboard
    │   ├── methodology.html       # How-it-works page
    │   └── tester.html            # Live sentiment tester
    │
    └── static/
        ├── css/style.css          # Custom styles + theme variables
        ├── js/                    # Page-specific JS
        └── img/banners/           # City SVG banners
```

## Local Development

### 1. Clone and set up virtual environment

```bash
git clone https://github.com/YOUR_USERNAME/mizaj-al-nas.git
cd mizaj-al-nas/webapp
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac
pip install -r requirements.txt
```

### 2. Install PyTorch (CPU-only — for local sentiment tester)

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

Skip this if you only need `SENTIMENT_MODE=api`.

### 3. Copy your data files

Place all 12 CSVs from your Kaggle pipeline into `webapp/data/raw/`:

```
processed_reviews.csv, llm_review_queue.csv, restaurant_summary.csv,
city_summary.csv, aspect_summary.csv, aspect_city_summary.csv,
benchmark_results.csv, bertopic_topics.csv, city_reliability.csv,
temporal_trends.csv, temporal_aspect_trends.csv, zero_shot_discovery.csv
```

Plus `sample_reviews.csv` (generate with `python scripts/extract_sample_reviews.py`).

### 4. Build the database

```bash
python scripts/build_database.py
```

### 5. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
- `SENTIMENT_MODE=local` (default — uses transformer models locally)
- `GROQ_API_KEY` — free from [console.groq.com/keys](https://console.groq.com/keys)
- `HF_TOKEN` — only needed if `SENTIMENT_MODE=api`

### 6. Run

```bash
python app.py
```

Visit `http://127.0.0.1:5000`

## Deployment (Render.com Free Tier)

The hosting build uses a lightweight stack (no torch/transformers — 512MB RAM limit)
with API-based sentiment inference.

### What works on hosting

| Feature | Status |
|---|---|
| Restaurant search & detail | Full |
| City analysis & trends | Full |
| Aspect breakdowns | Full (from sample reviews) |
| Sample review quotes | Full (207K sample reviews) |
| AI owner assistant | Full (Groq API) |
| Live sentiment tester | Full (HF Inference API) |
| Methodology page | Full |

### Steps

1. Push to GitHub (see `.gitignore` — large files are excluded)
2. Create a Render web service pointing to your GitHub repo
3. Set **Root Directory** = `webapp`
4. Build command: `pip install -r requirements-hosting.txt && python scripts/build_database_hosting.py`
5. Start command: `gunicorn app:app --bind 0.0.0.0:$PORT`
6. Set environment variables in Render dashboard:
   - `SENTIMENT_MODE` = `api`
   - `GROQ_API_KEY` = your key
   - `HF_TOKEN` = your token
   - `GROQ_MODEL` = `openai/gpt-oss-120b`

## API Reference

| Route | Method | Purpose |
|---|---|---|
| `/api/provinces` | GET | Province list with city/review counts |
| `/api/cities` | GET | City list, optional `?province=` filter |
| `/api/cities/<city>` | GET | City detail with aspect breakdown |
| `/api/restaurants` | GET | Search: `?search=&city=&page=&per_page=` |
| `/api/restaurants/<storeid>` | GET | Full detail with corrected aspect ranking |
| `/api/sentiment/analyze` | POST | `{"text": "..."}` → ensemble prediction |
| `/api/owner/assistant` | POST | `{"storeid": "...", "message": "..."}` |
| `/api/methodology` | GET | Benchmarks, topics, trends, reliability |

## Important: Aspect-Ranking Bug Fix

The raw CSV's `top_complaint_aspect` was ranked by raw negative-mention **count** (dominated by high-volume aspects like "taste"). The app derives a corrected `restaurant_aspect_summary` ranked by **pct_negative** with a minimum-mentions floor — so "hygiene" (66% negative) correctly outranks "taste" (33% negative) even though taste has 10x more mentions.

## Dataset

The full research dataset (1.55M reviews) is maintained locally and not included in this repository due to GitHub file size limits. The deployed version uses a compact 22MB subset (207K sample reviews) that preserves all user-facing functionality.

## Author

Independent student research project. Not affiliated with, sponsored by, or endorsed by Foodpanda.

## License

Educational / research project.
