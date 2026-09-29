"""REST management API.

Lets other systems (POS, e-commerce, ERP, CRM) push data into the warehouse
and lets operators monitor the pipeline. Interactive docs at /docs.

Auth: if SALESDW_API_KEY is set, every endpoint except /health requires the
header `X-API-Key: <key>`.
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, Query, Security, UploadFile
from fastapi.security import APIKeyHeader
from sqlalchemy import text

from . import __version__
from .config import get_settings
from .db import get_engine
from .etl.extract import SUPPORTED_EXTENSIONS
from .etl.pipeline import PipelineBusy, run_pipeline

app = FastAPI(title="SalesDW Management API", version=__version__,
              description="Ingest sales data, trigger ETL runs and monitor the warehouse.")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_key(key: str | None = Security(_api_key_header)) -> None:
    expected = get_settings().api_key
    if expected and key != expected:
        raise HTTPException(status_code=401, detail="invalid or missing X-API-Key")


def _entities() -> list[str]:
    return list(get_settings().mappings["entities"])


def _check_entity(entity: str | None) -> None:
    if entity is not None and entity not in _entities():
        raise HTTPException(422, f"unknown entity '{entity}', expected one of {_entities()}")


def _land(content: bytes, filename: str, entity: str | None) -> Path:
    """Write a file into the landing zone atomically (hidden temp name, then rename)."""
    s = get_settings()
    folder = s.incoming / entity if entity else s.incoming
    folder.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", Path(filename).name) or "upload"
    final = folder / f"{datetime.now():%Y%m%d%H%M%S}_{uuid.uuid4().hex[:6]}_{safe}"
    tmp = folder / f".{final.name}.part"
    tmp.write_bytes(content)
    tmp.rename(final)
    return final


def _process(paths: list[Path], trigger: str) -> dict[str, Any]:
    try:
        return {"queued": False, **run_pipeline(trigger=trigger, files=paths).to_dict()}
    except PipelineBusy:
        return {"queued": True, "detail": "a run is in progress; the file will be picked up by the next run"}


def _rows(sql: str, **params) -> list[dict]:
    with get_engine().connect() as conn:
        return [dict(r) for r in conn.execute(text(sql), params).mappings().all()]


# ------------------------------------------------------------------ routes ---

@app.get("/health", tags=["ops"])
def health() -> dict:
    try:
        _rows("SELECT 1 AS ok")
        db = "ok"
    except Exception as exc:  # noqa: BLE001
        db = f"error: {exc.__class__.__name__}"
    return {"status": "ok" if db == "ok" else "degraded", "database": db, "version": __version__}


@app.post("/files", tags=["ingest"], dependencies=[Depends(require_key)])
async def upload_file(file: UploadFile = File(...),
                      entity: str | None = Query(None, description="force the entity instead of auto-detecting"),
                      process: bool = Query(True, description="load immediately (otherwise the watcher picks it up)")):
    """Upload a CSV / Excel / JSON / Parquet export from any source system."""
    _check_entity(entity)
    if Path(file.filename or "").suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise HTTPException(415, f"supported file types: {sorted(SUPPORTED_EXTENSIONS)}")
    path = _land(await file.read(), file.filename or "upload.csv", entity)
    if not process:
        return {"landed": path.name, "queued": True}
    return {"landed": path.name, **_process([path], "api")}


@app.post("/records/{entity}", tags=["ingest"], dependencies=[Depends(require_key)])
def push_records(entity: str, records: list[dict[str, Any]], process: bool = True):
    """Push records as JSON (e.g. a webhook from a POS or web shop).
    Field names are mapped with the same aliases as files, so
    `{"Invoice No": "A1", "SKU": "P0001", "Qty": 2, "Price": 9.5, "Date": "2026-01-05"}` works."""
    _check_entity(entity)
    if not records:
        raise HTTPException(422, "no records")
    path = _land(json.dumps(records, default=str).encode(), f"{entity}.json", entity)
    if not process:
        return {"landed": path.name, "queued": True}
    return {"landed": path.name, **_process([path], "api")}


@app.post("/runs", tags=["pipeline"], dependencies=[Depends(require_key)])
def trigger_run():
    """Load everything currently waiting in the landing zone."""
    try:
        return run_pipeline(trigger="api").to_dict()
    except PipelineBusy as exc:
        raise HTTPException(409, str(exc)) from exc


@app.get("/runs", tags=["pipeline"], dependencies=[Depends(require_key)])
def list_runs(limit: int = Query(20, le=500)):
    return _rows("SELECT * FROM meta.etl_runs ORDER BY run_id DESC LIMIT :n", n=limit)


@app.get("/runs/{run_id}", tags=["pipeline"], dependencies=[Depends(require_key)])
def get_run(run_id: int):
    run = _rows("SELECT * FROM meta.etl_runs WHERE run_id = :id", id=run_id)
    if not run:
        raise HTTPException(404, "run not found")
    files = _rows("SELECT * FROM meta.ingested_files WHERE run_id = :id ORDER BY file_id", id=run_id)
    return {**run[0], "files": files}


@app.get("/rejects", tags=["data quality"], dependencies=[Depends(require_key)])
def list_rejects(run_id: int | None = None, limit: int = Query(100, le=5000)):
    return _rows("""SELECT * FROM meta.rejected_rows WHERE (CAST(:r AS BIGINT) IS NULL OR run_id = :r)
                    ORDER BY reject_id DESC LIMIT :n""", r=run_id, n=limit)


@app.get("/schema-drift", tags=["data quality"], dependencies=[Depends(require_key)])
def schema_drift():
    """Columns that arrived in source files but are not mapped yet (kept in extra_attributes)."""
    return _rows("SELECT * FROM meta.schema_drift ORDER BY last_seen_at DESC")


@app.get("/mappings", tags=["config"], dependencies=[Depends(require_key)])
def mappings():
    """The active column aliases / value mappings (edit config/schema_mappings.yaml)."""
    return get_settings().mappings


@app.get("/kpis", tags=["analytics"], dependencies=[Depends(require_key)])
def kpis(days: int = Query(30, ge=1, le=3650)):
    """Headline numbers for the last `days` days vs. the previous period
    (anchored on the latest order date in the warehouse)."""
    rows = _rows("""
        WITH anchor AS (SELECT max(d.full_date) AS last_day FROM dw.fact_sales f
                        JOIN dw.dim_date d ON d.date_key = f.order_date_key),
        p AS (
            SELECT CASE WHEN d.full_date > a.last_day - :days THEN 'current' ELSE 'previous' END AS period,
                   f.*
            FROM dw.fact_sales f JOIN dw.dim_date d ON d.date_key = f.order_date_key CROSS JOIN anchor a
            WHERE d.full_date > a.last_day - 2 * :days AND f.is_revenue)
        SELECT period, round(sum(net_amount), 2) AS net_sales, round(sum(profit_amount), 2) AS profit,
               count(DISTINCT order_id) AS orders, count(DISTINCT customer_key) AS customers,
               round(sum(net_amount) / NULLIF(count(DISTINCT order_id), 0), 2) AS avg_order_value
        FROM p GROUP BY period""", days=days)
    out: dict[str, Any] = {r.pop("period"): r for r in rows}
    cur, prev = out.get("current"), out.get("previous")
    if cur and prev and prev["net_sales"]:
        out["net_sales_growth"] = round(float(cur["net_sales"]) / float(prev["net_sales"]) - 1, 4)
    return out
