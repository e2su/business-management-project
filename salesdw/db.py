"""Database engine and schema bootstrap."""
from __future__ import annotations

from functools import lru_cache

from sqlalchemy import Engine, create_engine, text

from .config import PROJECT_ROOT, get_settings

SQL_DIR = PROJECT_ROOT / "warehouse" / "sql"
MERGE_DIR = PROJECT_ROOT / "warehouse" / "merge"


@lru_cache(maxsize=4)
def get_engine(url: str | None = None) -> Engine:
    return create_engine(url or get_settings().database_url, pool_pre_ping=True, future=True)


def init_db(engine: Engine | None = None) -> list[str]:
    """Create/upgrade all warehouse objects. Safe to run repeatedly."""
    engine = engine or get_engine()
    applied = []
    raw = engine.raw_connection()
    try:
        with raw.cursor() as cur:
            for f in sorted(SQL_DIR.glob("*.sql")):
                cur.execute(f.read_text())  # no params: SQL may contain literal '%'
                applied.append(f.name)
        raw.commit()
    finally:
        raw.close()
    return applied


def run_merge(conn, entity: str, batch_id: str) -> None:
    """Run warehouse/merge/<entity>.sql for one staged batch inside `conn`'s transaction."""
    sql = (MERGE_DIR / f"{entity}.sql").read_text()
    conn.execute(text(sql), {"batch_id": batch_id})


def ping(engine: Engine | None = None) -> bool:
    with (engine or get_engine()).connect() as conn:
        return conn.execute(text("SELECT 1")).scalar() == 1
