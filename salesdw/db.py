"""Database engine and schema bootstrap."""
from __future__ import annotations

from functools import lru_cache

from psycopg2 import sql
from sqlalchemy import Engine, create_engine, text

from .config import PROJECT_ROOT, get_settings

SQL_DIR = PROJECT_ROOT / "warehouse" / "sql"
MERGE_DIR = PROJECT_ROOT / "warehouse" / "merge"


@lru_cache(maxsize=4)
def get_engine(url: str | None = None) -> Engine:
    return create_engine(url or get_settings().database_url, pool_pre_ping=True, future=True)


def init_db(engine: Engine | None = None) -> list[str]:
    """Create/upgrade all warehouse objects. Safe to run repeatedly.
    Also creates the read-only Power BI login when POWERBI_DB_PASSWORD is set."""
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
    settings = get_settings()
    if settings.powerbi_password:
        ensure_reporting_user(engine, settings.powerbi_user, settings.powerbi_password)
        applied.append(f"read-only user '{settings.powerbi_user}'")
    return applied


def ensure_reporting_user(engine: Engine, user: str, password: str) -> None:
    """Create (or update the password of) a login that can only read the mart
    schema - the account Power BI and the data gateway should use."""
    role = sql.Identifier(user)
    raw = engine.raw_connection()
    try:
        with raw.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (user,))
            verb = "ALTER" if cur.fetchone() else "CREATE"
            # psycopg2 quotes the password client-side, so it is never spliced into SQL text
            cur.execute(sql.SQL(verb + " ROLE {} LOGIN PASSWORD %s").format(role), (password,))
            cur.execute(sql.SQL("GRANT USAGE ON SCHEMA mart TO {}").format(role))
            cur.execute(sql.SQL("GRANT SELECT ON ALL TABLES IN SCHEMA mart TO {}").format(role))
            # views created later (e.g. after adding a new mart view) are readable too
            cur.execute(sql.SQL("ALTER DEFAULT PRIVILEGES IN SCHEMA mart GRANT SELECT ON TABLES TO {}").format(role))
            cur.execute(sql.SQL("REVOKE ALL ON SCHEMA staging, dw, meta FROM {}").format(role))
        raw.commit()
    finally:
        raw.close()


def run_merge(conn, entity: str, batch_id: str) -> None:
    """Run warehouse/merge/<entity>.sql for one staged batch inside `conn`'s transaction."""
    sql = (MERGE_DIR / f"{entity}.sql").read_text()
    conn.execute(text(sql), {"batch_id": batch_id})


def ping(engine: Engine | None = None) -> bool:
    with (engine or get_engine()).connect() as conn:
        return conn.execute(text("SELECT 1")).scalar() == 1
