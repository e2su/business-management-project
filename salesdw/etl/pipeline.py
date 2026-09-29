"""Pipeline orchestration: discover files -> extract -> transform -> stage ->
merge into the warehouse, with full bookkeeping in the meta schema.

Each file is loaded in its own transaction: a broken file never leaves half a
load behind and never blocks the other files of the same run.
"""
from __future__ import annotations

import json
import logging
import shutil
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path

from sqlalchemy import Engine, text

from ..config import Settings, get_settings
from ..db import get_engine, run_merge
from .extract import SUPPORTED_EXTENSIONS, ExtractError, detect_entity, file_checksum, read_file
from .transform import transform

log = logging.getLogger("salesdw.pipeline")

# Dimensions first so facts can resolve their keys (late arrivals are still handled).
ENTITY_ORDER = ["stores", "customers", "products", "targets", "orders"]
STAGING_TABLE = {e: f"stg_{e}" for e in ENTITY_ORDER}


@dataclass
class FileResult:
    file: str
    entity: str | None
    status: str  # loaded | failed | skipped
    rows_read: int = 0
    rows_loaded: int = 0
    rows_rejected: int = 0
    new_columns: list[str] = field(default_factory=list)
    message: str | None = None


@dataclass
class RunSummary:
    run_id: int
    status: str
    files: list[FileResult]

    @property
    def rows_loaded(self) -> int:
        return sum(f.rows_loaded for f in self.files)

    @property
    def rows_rejected(self) -> int:
        return sum(f.rows_rejected for f in self.files)

    def to_dict(self) -> dict:
        return {"run_id": self.run_id, "status": self.status, "rows_loaded": self.rows_loaded,
                "rows_rejected": self.rows_rejected, "files": [asdict(f) for f in self.files]}


def discover_files(incoming: Path, min_age_seconds: float = 0) -> list[Path]:
    """Files waiting in the landing zone (recursively). Files modified in the last
    `min_age_seconds` are skipped because they may still be being copied."""
    now = time.time()
    return sorted(
        p for p in incoming.rglob("*")
        if p.is_file() and not p.name.startswith((".", "~", "_"))
        and p.suffix.lower() in SUPPORTED_EXTENSIONS
        and now - p.stat().st_mtime >= min_age_seconds
    )


class PipelineBusy(RuntimeError):
    """Another run (watcher, API or CLI) currently holds the pipeline lock."""


_LOCK_ID = 872_345_001  # arbitrary constant for pg_advisory_lock


def run_pipeline(*, engine: Engine | None = None, settings: Settings | None = None,
                 trigger: str = "manual", files: list[Path] | None = None,
                 min_age_seconds: float = 0) -> RunSummary:
    settings = settings or get_settings()
    engine = engine or get_engine(settings.database_url)
    settings.ensure_dirs()
    # Only one run at a time across all processes (watcher, API, CLI).
    with engine.connect() as lock_conn:
        if not lock_conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": _LOCK_ID}).scalar():
            raise PipelineBusy("another pipeline run is in progress")
        try:
            return _run(engine, settings, trigger, files, min_age_seconds)
        finally:
            lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": _LOCK_ID})
            lock_conn.commit()


def _run(engine, settings, trigger, files, min_age_seconds) -> RunSummary:
    files = files if files is not None else discover_files(settings.incoming, min_age_seconds)

    with engine.begin() as conn:
        run_id = conn.execute(text("INSERT INTO meta.etl_runs (trigger) VALUES (:t) RETURNING run_id"),
                              {"t": trigger}).scalar_one()
    log.info("run %s started: %d file(s)", run_id, len(files))

    # Extract every file first so they can be processed in dependency order.
    prepared, results = [], []
    for path in files:
        rel = _relative(path, settings.incoming)
        try:
            checksum = file_checksum(path)
            if _already_loaded(engine, checksum):
                res = FileResult(rel, None, "skipped", message="identical file already loaded")
                _record_file(engine, run_id, res, checksum)
                _archive(path, settings.processed, run_id)
                results.append(res)
                continue
            df = read_file(path)
            entity = detect_entity(path, list(df.columns), settings.mappings)
            prepared.append((path, rel, checksum, entity, df))
        except (ExtractError, OSError) as exc:
            res = FileResult(rel, None, "failed", message=str(exc))
            _record_file(engine, run_id, res, _safe_checksum(path))
            _archive(path, settings.failed, run_id)
            results.append(res)

    prepared.sort(key=lambda t: (ENTITY_ORDER.index(t[3]), t[1]))
    for path, rel, checksum, entity, df in prepared:
        res = _load_one(engine, settings, run_id, rel, checksum, entity, df)
        _archive(path, settings.processed if res.status == "loaded" else settings.failed, run_id)
        results.append(res)

    failed = [r for r in results if r.status == "failed"]
    status = "success" if not failed else ("failed" if len(failed) == len(results) else "partial")
    summary = RunSummary(run_id, status, results)
    msg = "; ".join(f"{r.file}: {r.message}" for r in failed)[:2000] or None
    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE meta.etl_runs SET finished_at = now(), status = :s, files_processed = :f,
                   rows_loaded = :l, rows_rejected = :r, message = :m WHERE run_id = :id"""),
            {"s": status, "f": len(results), "l": summary.rows_loaded, "r": summary.rows_rejected,
             "m": msg, "id": run_id})
    log.info("run %s finished: %s, %d rows loaded, %d rejected",
             run_id, status, summary.rows_loaded, summary.rows_rejected)
    return summary


def _load_one(engine, settings, run_id, rel, checksum, entity, df) -> FileResult:
    res = FileResult(rel, entity, "failed", rows_read=len(df))
    try:
        tr = transform(df, entity, settings.mappings, fx_rates=settings.fx_rates)
        res.rows_rejected = len(tr.rejects)
        res.new_columns = tr.unmapped_columns
        if tr.rows_read and len(tr.rejects) / tr.rows_read > settings.max_reject_ratio:
            raise ValueError(f"{len(tr.rejects)} of {tr.rows_read} rows rejected "
                             f"(limit {settings.max_reject_ratio:.0%}); first reason: {tr.rejects[0]['reason']}")

        batch_id = f"{run_id}-{uuid.uuid4().hex[:8]}"
        with engine.begin() as conn:
            if len(tr.data):
                staged = tr.data.assign(batch_id=batch_id)
                staged.to_sql(STAGING_TABLE[entity], conn, schema="staging", if_exists="append",
                              index=False, method="multi", chunksize=1000)
                run_merge(conn, entity, batch_id)
                conn.execute(text(f"DELETE FROM staging.{STAGING_TABLE[entity]} WHERE batch_id = :b"),
                             {"b": batch_id})
            _record_rejects(conn, run_id, rel, entity, tr.rejects)
            _record_drift(conn, entity, rel, tr.unmapped_columns)
        res.rows_loaded = len(tr.data)
        res.status = "loaded"
        if tr.unmapped_columns:
            res.message = f"new/unmapped columns kept in extra_attributes: {', '.join(tr.unmapped_columns)}"
    except Exception as exc:  # noqa: BLE001 - one bad file must not stop the run
        log.exception("failed to load %s", rel)
        res.status, res.rows_loaded = "failed", 0
        res.message = str(exc).splitlines()[0][:500]
    _record_file(engine, run_id, res, checksum)
    return res


# ------------------------------------------------------------ bookkeeping ---

def _already_loaded(engine, checksum: str) -> bool:
    with engine.connect() as conn:
        return conn.execute(text("SELECT 1 FROM meta.ingested_files WHERE checksum = :c AND status = 'loaded'"),
                            {"c": checksum}).first() is not None


def _record_file(engine, run_id, res: FileResult, checksum: str) -> None:
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO meta.ingested_files (run_id, file_name, checksum, entity, rows_read, rows_loaded,
                                             rows_rejected, status, message)
            VALUES (:run, :f, :c, :e, :rr, :rl, :rj, :s, :m)"""),
            {"run": run_id, "f": res.file, "c": checksum, "e": res.entity, "rr": res.rows_read,
             "rl": res.rows_loaded, "rj": res.rows_rejected, "s": res.status, "m": res.message})


def _record_rejects(conn, run_id, rel, entity, rejects) -> None:
    if not rejects:
        return
    conn.execute(text("""
        INSERT INTO meta.rejected_rows (run_id, file_name, entity, row_number, reason, payload)
        VALUES (:run, :f, :e, :n, :r, CAST(:p AS JSONB))"""),
        [{"run": run_id, "f": rel, "e": entity, "n": r["row_number"], "r": r["reason"],
          "p": json.dumps(r["payload"], default=str)} for r in rejects])


def _record_drift(conn, entity, rel, columns) -> None:
    for col in columns:
        conn.execute(text("""
            INSERT INTO meta.schema_drift (entity, column_name, first_seen_file) VALUES (:e, :c, :f)
            ON CONFLICT (entity, column_name) DO UPDATE
            SET last_seen_at = now(), times_seen = meta.schema_drift.times_seen + 1"""),
            {"e": entity, "c": col, "f": rel})


def _archive(path: Path, dest_root: Path, run_id: int) -> None:
    if not path.exists():
        return
    dest = dest_root / datetime.now().strftime("%Y-%m-%d") / f"run{run_id}_{path.name}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(path), dest)


def _relative(path: Path, root: Path) -> str:
    try:
        return str(path.resolve().relative_to(root.resolve()))
    except ValueError:
        return path.name


def _safe_checksum(path: Path) -> str:
    try:
        return file_checksum(path)
    except OSError:
        return "unreadable"
