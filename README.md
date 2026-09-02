<div align="center">

# مزاج الناس — Mizaj al-Nas

### *The Sentiment of the People*

**Regional review sentiment analysis for Foodpanda restaurants across Pakistan**

[![Live Demo](https://img.shields.io/badge/Live_Demo-mizaj--al--nas.onrender.com-0D6B3F?style=for-the-badge)](https://mizaj-al-nas.onrender.com)
![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python)
![Flask](https://img.shields.io/badge/Flask-3.1-black?style=flat-square&logo=flask)
![DuckDB](https://img.shields.io/badge/DuckDB-1.5-yellow?style=flat-square&logo=duckdb)

*Analyzing 1.55 million reviews across 16,000+ restaurants in 27 cities*

</div>

---

## Overview

Mizaj al-Nas is a full-stack sentiment analysis platform that processes Foodpanda restaurant reviews across Pakistan. It combines an ensemble of transformer models (XLM-RoBERTa + Roman Urdu fine-tune) with LLM-powered strategic recommendations to deliver actionable insights for both consumers and restaurant owners.

**[View Live Site →](https://mizaj-al-nas.onrender.com)**

## Features

### For Consumers
- **City Explorer** — Browse 27 cities with sentiment breakdowns, aspect heatmaps, and reliability scores
- **Restaurant Search** — Search and paginate 16,000+ restaurants with positive/negative sentiment percentages
- **Restaurant Detail** — Per-aspect breakdown with corrected ranking (rate-based, not volume-based), sample review quotes, and sentiment distribution charts
- **Live Sentiment Tester** — Type any review in English or Roman Urdu and get real-time ensemble predictions from two transformer models

### For Restaurant Owners
- **AI Owner Assistant** — LLM-powered assistant grounded in real per-restaurant statistics; generates 3 actionable improvement strategies with expected impact metrics
- **Aspect Drill-Down** — Identify exactly which aspects (taste, price, hygiene, delivery, packaging, portion, service) need attention
- **Competitive Benchmarking** — See how your restaurant compares within your city

### Research & Methodology
- **Benchmark Results** — Model comparison across English and Roman Urdu text (67.9% vs 48.8% Roman Urdu accuracy)
- **BERTopic Discovery** — 137 automatically discovered review topics with top keywords
- **Zero-Shot Aspect Discovery** — Novel aspects found beyond the original 7 categories
- **Temporal Trends** — Monthly sentiment shifts and aspect-level trend analysis
- **City Reliability** — Agreement rates and confidence scores per city

## Architecture

```
                    Browser (Tailwind CSS + Chart.js + vanilla JS)
                              │
                              ▼
                    ┌───────────────────┐
                    │   Flask / Gunicorn │
                    │   (Render Free)    │
                    └────────┬──────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌───────────┐  ┌───────────┐
        │  DuckDB  │  │  Groq LLM │  │ HF Infer. │
        │ (13.6 MB)│  │  (chat)   │  │  API      │
        └──────────┘  └───────────┘  └───────────┘
```

| Component | Local Dev | Production (Render Free) |
|---|---|---|
| Sentiment inference | 2× transformer models (local) | HuggingFace Inference API |
| AI assistant | Groq API | Groq API |
| Database | Full 227 MB DuckDB (1.55M reviews) | Compact 13.6 MB DuckDB (207K samples) |
| Server | Flask dev server | Gunicorn |

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.11, Flask 3.1, DuckDB 1.5, Pandas 2.2 |
| **Frontend** | Tailwind CSS (CDN), Chart.js 4, vanilla JavaScript |
| **ML/AI** | HuggingFace Transformers (XLM-RoBERTa), SentencePiece, Groq LLM |
| **Data** | 1.55M Foodpanda reviews, 16K restaurants, 27 cities, 7 aspect categories |
| **Hosting** | Render.com (free tier, 512 MB RAM), Gunicorn |
| **Ensemble** | cardiffnlp/twitter-xlm-roberta-base-sentiment + Khubaib01/roman-urdu-sentiment-xlm-r |

## Project Structure

```
├── render.yaml                          # Render.com one-click deploy config
├── README.md                            # This file
│
└── webapp/
    ├── app.py                           # Flask routes (7 pages + 7 API endpoints)
    ├── config.py                        # Env-driven configuration
    ├── requirements.txt                 # Full local dev deps (includes torch)
    ├── requirements-hosting.txt         # Lightweight hosting deps (no torch)
    ├── .env.example                     # Template for API keys
    │
    ├── services/
    │   ├── db.py                        # DuckDB connection + static JSON loader
    │   ├── sentiment_model.py           # Ensemble sentiment (local + API modes)
    │   ├── groq_assistant.py            # Owner AI assistant (restaurant-grounded)
    │   └── province_mapping.py          # Pakistan city → province lookup
    │
    ├── scripts/
    │   ├── build_database.py            # Full local DB (all 12 CSVs → 227 MB)
    │   ├── build_database_hosting.py    # Hosting DB (small CSVs → 13.6 MB)
    │   └── extract_sample_reviews.py    # 390 MB → 22 MB sample subset
    │
    ├── data/
    │   ├── raw/                         # Source CSVs (2 large files gitignored)
    │   └── processed/                   # DuckDB + static JSON (rebuilt on deploy)
    │
    ├── templates/                       # 8 Jinja2 HTML templates
    │   ├── base.html                    # Layout + Arabic calligraphy navbar
    │   ├── landing.html                 # Homepage with hero + live stats
    │   ├── user.html                    # City explorer
    │   ├── restaurant_detail.html       # Restaurant drill-down
    │   ├── owner_search.html            # Owner portal
    │   ├── owner_dashboard.html         # Owner AI dashboard
    │   ├── methodology.html             # Research methodology
    │   └── tester.html                  # Live sentiment tester
    │
    └── static/
        ├── css/style.css                # Custom theme + responsive styles
        ├── js/                          # 7 page-specific JavaScript modules
        └── img/banners/                 # City SVG banners (Karachi, Lahore, etc.)
```

## Local Development

### Prerequisites
- Python 3.11+
- 4 GB+ RAM (for local transformer models)

### Setup

```bash
git clone https://github.com/saqlainAbbas11/Mizaj-al-Nas-Foodpanda-regional-sentiment-analysis-.git
cd Mizaj-al-Nas-Foodpanda-regional-sentiment-analysis-/webapp

# 1. Virtual environment
python -m venv venv
venv\Scripts\activate              # Windows
# source venv/bin/activate         # Linux/Mac

# 2. Install dependencies
pip install -r requirements.txt
pip install torch --index-url https://download.pytorch.org/whl/cpu

# 3. Copy and configure environment
cp .env.example .env
# Edit .env — add GROQ_API_KEY from https://console.groq.com/keys

# 4. Place your 12 Kaggle output CSVs in data/raw/

# 5. Build database
python scripts/build_database.py

# 6. Run
python app.py
```

Visit `http://127.0.0.1:5000`

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/provinces` | GET | Province list with city/review counts |
| `/api/cities` | GET | All cities, optional `?province=` filter |
| `/api/cities/<city>` | GET | City detail: sentiment mix, aspects, top restaurants |
| `/api/restaurants` | GET | Search: `?search=&city=&page=&per_page=` |
| `/api/restaurants/<id>` | GET | Full detail: corrected aspects, sample reviews |
| `/api/sentiment/analyze` | POST | `{"text": "..."}` → ensemble prediction |
| `/api/owner/assistant` | POST | `{"storeid": "...", "message": "..."}` |
| `/api/methodology` | GET | Benchmarks, topics, trends, reliability |

## Key Design Decision: Aspect-Ranking Correction

The raw dataset's `top_complaint_aspect` ranks by raw negative-mention **count** — dominated by high-volume aspects like "taste" (10× more mentions than "hygiene"). This project derives a corrected `restaurant_aspect_summary` ranked by **percentage negative** with a minimum-mentions floor, so "hygiene" at 66% negative correctly outranks "taste" at 33% negative.

## Dataset

| Metric | Value |
|---|---|
| Total reviews | 1,552,204 |
| Restaurants | 16,103 |
| Cities | 27 |
| Aspect categories | 7 (taste, price, hygiene, delivery, packaging, portion, service) |
| Hosting subset | 207K sample reviews (22 MB) |

The full research dataset is maintained locally. The deployed version uses a compact representative subset generated by `scripts/extract_sample_reviews.py` (5 reviews per sentiment per restaurant).

## Deployment

Deployed on Render.com free tier using a dual-requirements strategy:
- **Local**: Full ML stack (torch, transformers, sentencepiece) — ~2 GB
- **Hosting**: Lightweight API-only (flask, duckdb, groq) — ~50 MB

See [`render.yaml`](render.yaml) for the one-click deploy configuration.

## Author

**Saqlain Abbas** — Independent student research project

*Not affiliated with, sponsored by, or endorsed by Foodpanda.*

## License

Educational / research project.
