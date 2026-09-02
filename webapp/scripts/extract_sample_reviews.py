"""
Extract a compact sample_reviews.csv from the full processed_reviews.csv.
Keeps 5 positive + 5 negative + 5 neutral reviews per restaurant.
This small file (~2-5MB) goes to GitHub so the hosted site can show real review quotes.
"""
import pandas as pd
from pathlib import Path

RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
INPUT = RAW_DIR / "processed_reviews.csv"
OUTPUT = RAW_DIR / "sample_reviews.csv"

SAMPLES_PER_SENTIMENT = 5

print(f"Reading {INPUT}...")
df = pd.read_csv(INPUT)
print(f"  Total reviews: {len(df):,}")
print(f"  Columns: {list(df.columns)}")
print(f"  Sentiments: {df['sentiment_final'].value_counts().to_dict()}")
print(f"  Unique restaurants: {df['storeid'].nunique():,}")

# Sample 5 per sentiment per restaurant
cols = ["storeid", "city", "text", "sentiment_final", "ensemble_confidence", "aspects", "overall"]
sampled = (
    df[cols]
    .groupby(["storeid", "sentiment_final"], group_keys=False)
    .apply(lambda g: g.sample(n=min(SAMPLES_PER_SENTIMENT, len(g)), random_state=42))
    .reset_index(drop=True)
)

print(f"\nSampled reviews: {len(sampled):,}")
print(f"  By sentiment: {sampled['sentiment_final'].value_counts().to_dict()}")
print(f"  Estimated size: ~{sampled.memory_usage(deep=True).sum() / 1e6:.1f} MB in memory")

sampled.to_csv(OUTPUT, index=False)
file_size = OUTPUT.stat().st_size / 1e6
print(f"\nWrote {OUTPUT} ({file_size:.1f} MB)")
print("This file is small enough for GitHub (<100MB limit).")
