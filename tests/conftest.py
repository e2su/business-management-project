"""Integration tests need a PostgreSQL database they may wipe:

    export TEST_DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/sales_dw_test

Without it, only the pure-Python tests run.
"""
import os

import pytest
from sqlalchemy import create_engine, text

from salesdw import config, db

TEST_DB = os.environ.get("TEST_DATABASE_URL")


def _db_available() -> bool:
    if not TEST_DB:
        return False
    try:
        with create_engine(TEST_DB).connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001
        return False


requires_db = pytest.mark.skipif(not _db_available(), reason="TEST_DATABASE_URL not set or unreachable")


@pytest.fixture
def mappings():
    return config.load_settings().mappings


@pytest.fixture
def env(tmp_path, monkeypatch):
    """Fresh warehouse + empty landing zone for each test."""
    monkeypatch.setenv("DATABASE_URL", TEST_DB)
    for name in ("incoming", "processed", "failed"):
        monkeypatch.setenv(f"SALESDW_{name.upper()}", str(tmp_path / name))
    monkeypatch.delenv("SALESDW_API_KEY", raising=False)
    config.get_settings.cache_clear()
    db.get_engine.cache_clear()
    engine = db.get_engine()
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS staging, dw, mart, meta CASCADE"))
    db.init_db(engine)
    settings = config.get_settings()
    settings.ensure_dirs()
    yield settings, engine
    engine.dispose()
    config.get_settings.cache_clear()
    db.get_engine.cache_clear()


def scalar(engine, sql, **params):
    with engine.connect() as conn:
        return conn.execute(text(sql), params).scalar()
