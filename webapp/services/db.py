"""Thin data-access layer. DuckDB is opened once in read-only mode (safe for concurrent Flask
requests — DuckDB supports multiple concurrent readers against the same file). Small tables are
loaded into plain Python dicts/lists once at import time; they're tiny (max 188 rows) so there's
no reason to hit a database for them on every request."""
import json
import duckdb
import pandas as pd

import config

_con = None


def get_db():
    global _con
    if _con is None:
        if not config.DB_PATH.exists():
            raise FileNotFoundError(
                f"{config.DB_PATH} not found. Run `python scripts/build_database.py` first "
                f"(after copying your Kaggle output CSVs into data/raw/)."
            )
        _con = duckdb.connect(str(config.DB_PATH), read_only=True)
    return _con


def query_df(sql: str, params: list | None = None) -> pd.DataFrame:
    con = get_db()
    return con.execute(sql, params or []).fetchdf()


def query_records(sql: str, params: list | None = None) -> list[dict]:
    df = query_df(sql, params)
    return json.loads(df.to_json(orient="records"))


_static_cache: dict[str, list[dict]] = {}


def load_static(name: str) -> list[dict]:
    """Load one of the small precomputed tables (city_summary, aspect_summary, etc.) from its
    static JSON file. Cached after first read."""
    if name not in _static_cache:
        path = config.STATIC_DATA_DIR / f"{name}.json"
        if not path.exists():
            raise FileNotFoundError(
                f"{path} not found. Run `python scripts/build_database.py` first."
            )
        with open(path) as f:
            _static_cache[name] = json.load(f)
    return _static_cache[name]
