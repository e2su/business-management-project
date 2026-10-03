"""Export the mart layer to a JSON file for the static dashboard in site/.

The GitHub Pages workflow runs the real pipeline (generate -> ETL -> warehouse)
and then calls this, so the published site always shows what the warehouse
contains. Periods are anchored on the latest order date in the warehouse.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

from sqlalchemy import Engine, text

from .db import get_engine

ANCHOR = "(SELECT max(d.full_date) FROM dw.fact_sales f JOIN dw.dim_date d ON d.date_key = f.order_date_key)"

QUERIES = {
    # Headline numbers: trailing 12 months vs the 12 months before.
    "kpis": f"""
        WITH a AS (SELECT {ANCHOR} AS last_day),
        p AS (
            SELECT CASE WHEN d.full_date > a.last_day - 365 THEN 'current' ELSE 'previous' END AS period, f.*
            FROM dw.fact_sales f JOIN dw.dim_date d ON d.date_key = f.order_date_key CROSS JOIN a
            WHERE d.full_date > a.last_day - 730)
        SELECT period,
               sum(net_amount)    FILTER (WHERE is_revenue)  AS net_sales,
               sum(profit_amount) FILTER (WHERE is_revenue)  AS profit,
               count(DISTINCT order_id) FILTER (WHERE is_revenue) AS orders,
               count(DISTINCT customer_key) FILTER (WHERE is_revenue) AS customers,
               sum(net_amount) FILTER (WHERE is_returned) AS returned
        FROM p GROUP BY period""",
    "monthly": """
        SELECT "Month" AS month, "Net Sales" AS net_sales, "Profit" AS profit, "Orders" AS orders,
               "Avg Order Value" AS aov, "Return Rate" AS return_rate
        FROM mart.monthly_kpis ORDER BY "Month" """,
    "regions": f"""
        SELECT s.region, sum(f.net_amount) AS net_sales
        FROM dw.fact_sales f
        JOIN dw.dim_store s ON s.store_key = f.store_key
        JOIN dw.dim_date d ON d.date_key = f.order_date_key
        WHERE f.is_revenue AND d.full_date > {ANCHOR} - 365
        GROUP BY s.region ORDER BY net_sales DESC""",
    "channels": f"""
        SELECT s.channel, sum(f.net_amount) AS net_sales
        FROM dw.fact_sales f
        JOIN dw.dim_store s ON s.store_key = f.store_key
        JOIN dw.dim_date d ON d.date_key = f.order_date_key
        WHERE f.is_revenue AND d.full_date > {ANCHOR} - 365
        GROUP BY s.channel ORDER BY net_sales DESC""",
    # Target attainment per store over the last 12 months that have both target and sales.
    "stores": f"""
        SELECT "Store" AS store, "Region" AS region, sum("Target") AS target, sum("Actual") AS actual
        FROM mart.target_vs_actual
        WHERE "Store ID" <> 'ALL' AND "Category" = 'ALL' AND "Actual" > 0
          AND "Month" > date_trunc('month', {ANCHOR}) - INTERVAL '12 months'
          AND "Month" <= date_trunc('month', {ANCHOR})
        GROUP BY 1, 2 ORDER BY sum("Actual") / NULLIF(sum("Target"), 0) DESC""",
    "products": """
        SELECT "Product" AS product, "Category" AS category, "Net Sales" AS net_sales,
               "Margin %" AS margin, "ABC Class" AS abc
        FROM mart.product_performance ORDER BY "Sales Rank" LIMIT 10""",
    "abc": """
        SELECT "ABC Class" AS abc, count(*) AS products, sum("Net Sales") AS net_sales
        FROM mart.product_performance GROUP BY 1 ORDER BY 1""",
    "rfm": """
        SELECT "RFM Segment" AS segment, count(*) AS customers, sum("Lifetime Net Sales") AS net_sales
        FROM mart.customer_rfm GROUP BY 1 ORDER BY 2 DESC""",
    "runs": """
        SELECT "Run ID" AS run_id, "Trigger" AS trigger, "Started At" AS started_at, "Status" AS status,
               "Files" AS files, "Rows Loaded" AS rows_loaded, "Rows Rejected" AS rows_rejected
        FROM mart.pipeline_health ORDER BY "Run ID" DESC LIMIT 10""",
    "files": """
        SELECT run_id, file_name, entity, status, rows_loaded, rows_rejected, message
        FROM meta.ingested_files ORDER BY file_id DESC LIMIT 12""",
    "drift": "SELECT entity, column_name, times_seen, first_seen_file FROM meta.schema_drift ORDER BY last_seen_at DESC",
    "warehouse": f"""
        SELECT (SELECT count(*) FROM dw.fact_sales) AS sales_lines,
               (SELECT count(DISTINCT order_id) FROM dw.fact_sales) AS orders,
               (SELECT count(*) FROM dw.dim_customer WHERE is_current) AS customers,
               (SELECT count(*) FROM dw.dim_customer WHERE NOT is_current) AS customer_history_rows,
               (SELECT count(*) FROM dw.dim_product WHERE is_current) AS products,
               (SELECT count(*) FROM dw.dim_store) AS stores,
               (SELECT count(DISTINCT currency) FROM dw.fact_sales) AS currencies,
               (SELECT min(d.full_date) FROM dw.fact_sales f JOIN dw.dim_date d ON d.date_key = f.order_date_key) AS first_day,
               {ANCHOR} AS last_day""",
}


def _plain(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def build_site_data(engine: Engine | None = None) -> dict:
    engine = engine or get_engine()
    out: dict = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    with engine.connect() as conn:
        for key, sql in QUERIES.items():
            rows = conn.execute(text(sql)).mappings().all()
            out[key] = [{k: _plain(v) for k, v in r.items()} for r in rows]
    out["kpis"] = {r.pop("period"): r for r in out["kpis"]}
    out["warehouse"] = out["warehouse"][0] if out["warehouse"] else {}
    return out


def export_site(out_path: Path, engine: Engine | None = None) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(build_site_data(engine), indent=1))
    return out_path
