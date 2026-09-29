"""Command line: `python -m salesdw <command>`.

  init-db     create / upgrade warehouse schemas, tables and Power BI views
  run         load every file waiting in data/incoming once
  watch       keep running: load new files as soon as they land (the "live" mode)
  generate    create demo data (history, or one day of new activity with --increment)
  status      show recent runs, files, rejects and new columns
  serve       start the REST management API
"""
from __future__ import annotations

import argparse
import json
import logging
import time
from datetime import date, timedelta
from pathlib import Path

from sqlalchemy import text

from .config import get_settings
from .db import get_engine, init_db
from .etl.pipeline import PipelineBusy, discover_files, run_pipeline
from .generator import generate_history, generate_increment

log = logging.getLogger("salesdw")


def _wait_for_db(retries: int = 30) -> None:
    for attempt in range(retries):
        try:
            with get_engine().connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except Exception:  # noqa: BLE001
            if attempt == retries - 1:
                raise
            log.info("waiting for database...")
            time.sleep(2)


def cmd_init_db(_args) -> None:
    _wait_for_db()
    for name in init_db():
        print(f"applied {name}")


def cmd_run(args) -> None:
    summary = run_pipeline(trigger=args.trigger)
    print(json.dumps(summary.to_dict(), indent=2, default=str))


def cmd_watch(args) -> None:
    _wait_for_db()
    init_db()
    s = get_settings()
    interval = args.interval or s.watch_interval_seconds
    log.info("watching %s every %ss (Ctrl+C to stop)", s.incoming, interval)
    while True:
        s.ensure_dirs()
        # min_age avoids picking up a file that is still being copied in
        if discover_files(s.incoming, min_age_seconds=3):
            try:
                summary = run_pipeline(trigger="watcher", min_age_seconds=3)
                log.info("run %s: %s (%d loaded, %d rejected)", summary.run_id, summary.status,
                         summary.rows_loaded, summary.rows_rejected)
            except PipelineBusy:
                log.info("another run is in progress; will retry")
            except Exception:  # noqa: BLE001 - keep the watcher alive
                log.exception("pipeline run failed")
        if args.once:
            break
        time.sleep(interval)


def cmd_generate(args) -> None:
    out = Path(args.out) if args.out else get_settings().incoming
    if args.increment:
        day = date.fromisoformat(args.day) if args.day else date.today()
        files = generate_increment(out, day, daily_orders=args.daily_orders, customers=args.customers)
    else:
        end = date.fromisoformat(args.end) if args.end else date.today() - timedelta(days=1)
        start = date.fromisoformat(args.start) if args.start else date(end.year - 2, 1, 1)
        files = generate_history(out, start, end, customers=args.customers, daily_orders=args.daily_orders)
    for f in files:
        print(f"wrote {f}")


def cmd_status(args) -> None:
    queries = {
        "recent runs": "SELECT run_id, trigger, status, files_processed, rows_loaded, rows_rejected, "
                       "started_at::timestamp(0), message FROM meta.etl_runs ORDER BY run_id DESC LIMIT :n",
        "recent files": "SELECT run_id, file_name, entity, status, rows_loaded, rows_rejected, message "
                        "FROM meta.ingested_files ORDER BY file_id DESC LIMIT :n",
        "latest rejects": "SELECT run_id, file_name, row_number, reason FROM meta.rejected_rows "
                          "ORDER BY reject_id DESC LIMIT :n",
        "unmapped columns (add to config/schema_mappings.yaml to promote)":
            "SELECT entity, column_name, times_seen, first_seen_file FROM meta.schema_drift ORDER BY last_seen_at DESC LIMIT :n",
        "warehouse size": "SELECT (SELECT count(*) FROM dw.fact_sales) AS sales_lines, "
                          "(SELECT count(*) FROM dw.dim_customer WHERE is_current) AS customers, "
                          "(SELECT count(*) FROM dw.dim_product WHERE is_current) AS products, "
                          "(SELECT count(*) FROM dw.dim_store) AS stores, "
                          "(SELECT max(loaded_at)::timestamp(0) FROM dw.fact_sales) AS last_load",
    }
    with get_engine().connect() as conn:
        for title, q in queries.items():
            rows = conn.execute(text(q), {"n": args.limit}).mappings().all()
            print(f"\n== {title} ==")
            for r in rows:
                print("  " + " | ".join(f"{k}={v}" for k, v in r.items()))
            if not rows:
                print("  (none)")


def cmd_serve(args) -> None:
    import uvicorn
    _wait_for_db()
    init_db()
    uvicorn.run("salesdw.api:app", host=args.host, port=args.port)


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    p = argparse.ArgumentParser(prog="salesdw", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("init-db").set_defaults(func=cmd_init_db)

    r = sub.add_parser("run")
    r.add_argument("--trigger", default="manual")
    r.set_defaults(func=cmd_run)

    w = sub.add_parser("watch")
    w.add_argument("--interval", type=int)
    w.add_argument("--once", action="store_true", help="check once and exit")
    w.set_defaults(func=cmd_watch)

    g = sub.add_parser("generate")
    g.add_argument("--out", help="output folder (default: the incoming folder)")
    g.add_argument("--start", help="first order date, YYYY-MM-DD (default: Jan 1st two years ago)")
    g.add_argument("--end", help="last order date (default: yesterday)")
    g.add_argument("--customers", type=int, default=1500)
    g.add_argument("--daily-orders", type=int, default=40)
    g.add_argument("--increment", action="store_true", help="one day of new POS + CRM data")
    g.add_argument("--day", help="day for --increment (default: today)")
    g.set_defaults(func=cmd_generate)

    st = sub.add_parser("status")
    st.add_argument("--limit", type=int, default=10)
    st.set_defaults(func=cmd_status)

    sv = sub.add_parser("serve")
    sv.add_argument("--host", default="0.0.0.0")
    sv.add_argument("--port", type=int, default=8000)
    sv.set_defaults(func=cmd_serve)

    args = p.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
