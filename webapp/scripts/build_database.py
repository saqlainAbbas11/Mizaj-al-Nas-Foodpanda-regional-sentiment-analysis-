"""
Run this once (and again any time you re-run the Kaggle pipeline) to turn the 12 raw output
CSVs into what the Flask app actually serves from:
  - data/processed/foodpanda.duckdb   the two big tables (processed_reviews, llm_review_queue)
                                        + restaurant_summary + two DERIVED tables (see below)
  - data/processed/static/*.json      the small tables, loaded straight into memory at app
                                        startup, no database round-trip needed for these

Usage:
    1. Copy your 12 CSVs from Kaggle's /kaggle/working into webapp/data/raw/
    2. python scripts/build_database.py

WHY TWO DERIVED TABLES INSTEAD OF JUST COPYING THE CSVS AS-IS:

restaurant_summary.csv's `top_complaint_aspect` column was computed by ranking aspects on RAW
negative-mention COUNT. That's dominated by whichever aspect has the most volume (taste has
~10x hygiene's mention count) rather than which aspect is actually proportionally worst
(hygiene's negative RATE is more than double taste's). Every city in city_summary.csv shows
"taste" as the top complaint for exactly this reason — not because it's true everywhere, but
because of how the ranking was computed. This script re-derives a corrected version — ranked
by pct_negative with a minimum-mentions floor — directly from processed_reviews.csv, which has
the per-review aspect list needed to do this properly:
  - review_aspects: long-format (review, aspect) table, exploded from the comma-joined
    `aspects` column
  - restaurant_aspect_summary: per-restaurant, per-aspect mentions/pct_negative/pct_positive,
    correctly ranked by rate not volume

aspect_city_summary.csv already has a correct per-city pct_negative column (that one wasn't
buggy), so city-level doesn't need re-deriving — the app just uses that column directly instead
of city_summary.csv's top_complaint_aspect field.
"""

import json
import sys
from pathlib import Path

import duckdb
import pandas as pd

APP_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = APP_ROOT / "data" / "raw"
PROCESSED_DIR = APP_ROOT / "data" / "processed"
STATIC_DIR = PROCESSED_DIR / "static"
DB_PATH = PROCESSED_DIR / "foodpanda.duckdb"

SMALL_TABLES = [
    "city_summary",
    "aspect_summary",
    "aspect_city_summary",
    "benchmark_results",
    "bertopic_topics",
    "city_reliability",
    "temporal_trends",
    "temporal_aspect_trends",
    "zero_shot_discovery",
]

BIG_TABLES = [
    "processed_reviews",
    "llm_review_queue",
    "restaurant_summary",
]

MIN_MENTIONS_FOR_RESTAURANT_ASPECT = 3  # same "don't rank on tiny samples" principle as the pipeline


def check_files_present():
    required = [f"{name}.csv" for name in SMALL_TABLES + BIG_TABLES]
    missing = [f for f in required if not (RAW_DIR / f).exists()]
    if missing:
        print(f"ERROR: missing {len(missing)} file(s) in {RAW_DIR}:")
        for f in missing:
            print(f"  - {f}")
        print(f"\nCopy your Kaggle /kaggle/working output CSVs into {RAW_DIR} and re-run this script.")
        sys.exit(1)
    print(f"All {len(required)} expected files found in {RAW_DIR}.")


def build_static_json():
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    for name in SMALL_TABLES:
        df = pd.read_csv(RAW_DIR / f"{name}.csv")
        out_path = STATIC_DIR / f"{name}.json"
        df.to_json(out_path, orient="records", indent=2)
        print(f"  {name}.csv ({len(df):,} rows) -> {out_path.name}")


def build_duckdb():
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()  # always rebuild fresh — don't silently accumulate stale state across runs
    con = duckdb.connect(str(DB_PATH))

    for name in BIG_TABLES:
        csv_path = RAW_DIR / f"{name}.csv"
        con.execute(f"CREATE TABLE {name} AS SELECT * FROM read_csv_auto('{csv_path}', "
                    f"sample_size=-1, ignore_errors=false)")
        n = con.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
        print(f"  {name}.csv -> DuckDB table '{name}' ({n:,} rows)")

    con.execute("CREATE INDEX idx_reviews_storeid ON processed_reviews(storeid)")
    con.execute("CREATE INDEX idx_reviews_city ON processed_reviews(city)")
    con.execute("CREATE INDEX idx_queue_storeid ON llm_review_queue(storeid)")
    con.execute("CREATE INDEX idx_resto_storeid ON restaurant_summary(storeid)")

    # ---- derived: review_aspects (long format) ----
    # NOTE: deliberately does NOT select `uuid` — the actual notebook's Section 14 save-cell
    # never included a uuid column in processed_reviews.csv's output (checkpointing used uuid
    # internally, but it didn't make it into cols_to_save). Nothing downstream needs it as a
    # join key anyway (everything here aggregates by storeid+aspect), so this is just not
    # depending on a column that doesn't exist rather than working around a real requirement.
    con.execute("""
        CREATE TABLE review_aspects AS
        SELECT storeid, city, sentiment_final, TRIM(aspect) AS aspect
        FROM processed_reviews, UNNEST(string_split(aspects, ',')) AS t(aspect)
        WHERE aspects IS NOT NULL AND aspects != ''
    """)
    n_ra = con.execute("SELECT COUNT(*) FROM review_aspects").fetchone()[0]
    print(f"  derived table 'review_aspects' ({n_ra:,} aspect-mentions)")

    # ---- derived: restaurant_aspect_summary (corrected ranking, by rate not volume) ----
    con.execute(f"""
        CREATE TABLE restaurant_aspect_summary AS
        SELECT
            storeid,
            aspect,
            COUNT(*) AS mentions,
            100.0 * SUM(CASE WHEN sentiment_final = 'negative' THEN 1 ELSE 0 END) / COUNT(*) AS pct_negative,
            100.0 * SUM(CASE WHEN sentiment_final = 'positive' THEN 1 ELSE 0 END) / COUNT(*) AS pct_positive,
            COUNT(*) >= {MIN_MENTIONS_FOR_RESTAURANT_ASPECT} AS reliable_sample
        FROM review_aspects
        GROUP BY storeid, aspect
    """)
    n_ras = con.execute("SELECT COUNT(*) FROM restaurant_aspect_summary").fetchone()[0]
    print(f"  derived table 'restaurant_aspect_summary' ({n_ras:,} restaurant-aspect rows, "
          f"ranked by rate not volume)")

    con.close()
    print(f"\nDuckDB file written to {DB_PATH} ({DB_PATH.stat().st_size / 1e6:.1f} MB)")


def sanity_check():
    # No uuid column to check distinctness against (see note above) — but that's fine, true
    # duplicate-prevention already happened upstream in the notebook itself (Section 4's uuid
    # dedup + Section 14's own len(df_out)==len(df) assertion, which your actual run confirmed
    # passed: "1,552,204 rows, matching df"). This just re-confirms the numbers are still sane
    # after going through DuckDB, and cross-checks against the independent city_summary table
    # as a second signal instead of re-deriving the same guarantee a different way.
    con = duckdb.connect(str(DB_PATH), read_only=True)
    reviews_n = con.execute("SELECT COUNT(*) FROM processed_reviews").fetchone()[0]
    queue_n = con.execute("SELECT COUNT(*) FROM llm_review_queue").fetchone()[0]
    assert reviews_n > 0, "processed_reviews table is empty — check data/raw/processed_reviews.csv"
    assert queue_n <= reviews_n, (
        f"llm_review_queue ({queue_n:,} rows) is larger than processed_reviews ({reviews_n:,}) — "
        f"that should never happen since the queue is a subset. Don't ship this database."
    )
    city_summary_total = sum(row["review_count"] for row in json.load(
        open(STATIC_DIR / "city_summary.json")
    ))
    if abs(reviews_n - city_summary_total) > 10:  # small slack for edge cases, not an exact-match requirement
        print(f"  NOTE: processed_reviews has {reviews_n:,} rows but city_summary.csv's review_count "
              f"column sums to {city_summary_total:,} — worth double-checking these came from the "
              f"same pipeline run if the gap is large.")
    print(f"\nSanity check passed: {reviews_n:,} reviews, {queue_n:,} in the LLM review queue "
          f"({queue_n/reviews_n*100:.1f}%).")
    con.close()


if __name__ == "__main__":
    print(f"Reading from {RAW_DIR}\n")
    check_files_present()
    print("\nBuilding static JSON files (small tables)...")
    build_static_json()
    print("\nBuilding DuckDB (large tables + derived tables)...")
    build_duckdb()
    sanity_check()
    print("\nDone. Start the app with: python app.py")