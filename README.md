# SalesDW — Sales Analytics Management System

A complete, self-hosted **sales data platform** for a company: ETL pipelines load
data from any source system into a **PostgreSQL data warehouse** (star schema),
and **Power BI** dashboards read from a curated reporting layer. It runs on
your own infrastructure (Docker locally, or an **Azure VM via Terraform** — IaaS).

It's built to keep working as the business changes. New files are picked up
automatically, new column names are handled through config instead of code
changes, unknown columns are kept rather than dropped, and late or corrected
data is merged in place.

```
 Source systems                 ETL (Python)                     Warehouse (PostgreSQL)            BI
 ───────────────                ────────────                     ──────────────────────            ──
 POS exports  ─┐                                                 staging.*  (transient)
 Web shop     ─┤  CSV / Excel   ┌──────────────────────────┐      │
 ERP / CRM    ─┼─ JSON / Parquet│ extract → detect entity   │      ▼
 Spreadsheets ─┤  ─────────────►│ transform → map columns,  │──► dw.*  star schema            ┌──────────┐
 Webhooks     ─┘  REST API      │   cast, validate, dedupe  │      dim_date / customer (SCD2) │ Power BI │
                  or drop folder│ load → stage + SQL merge  │      product (SCD2) / store     │ dashboards│
                                └──────────────────────────┘      sales_rep, fact_sales,     │          │
                                   ▲ watcher (every 30 s)          fact_sales_target  ──► mart.* views ─┘
                                   │ meta.* run log, rejects,
                                   │ schema drift
```

## What's inside

| Area | Where | Highlights |
|---|---|---|
| Data warehouse | `warehouse/sql/` | Star schema, SCD type 2 customers/products, auto-growing calendar, KPI / RFM / ABC / target-vs-actual views |
| ETL pipeline | `salesdw/etl/` | Auto-detects file type & entity, column aliases, value normalisation, data-quality rejects, idempotent loads, per-file transactions |
| Merge logic (ELT) | `warehouse/merge/` | Set-based SQL: SCD2, late-arriving dimensions (inferred members), fact upserts with point-in-time key lookup |
| Live ingestion | `salesdw/cli.py watch`, `salesdw/api.py` | Folder watcher + REST API (upload files, push JSON records, trigger runs, monitor) |
| Power BI | `powerbi/` | Connection & model guide, 40+ DAX measures, theme, page blueprint |
| Infrastructure | `docker-compose.yml`, `infra/terraform/` | One-command local stack; Azure VM + data disk + NSG + nightly backups |
| Demo data | `salesdw/generator.py` | "Horizon Retail Co.": 10 stores in 6 countries/currencies, seasonality, growth, promotions, returns |
| Tests / CI | `tests/`, `.github/workflows/ci.yml` | Unit + end-to-end tests against real PostgreSQL |

## Quick start (Docker)

```bash
cp .env.example .env                      # set passwords / API key
docker compose up -d --build              # db + api + watcher

# load 2 years of demo history (the watcher picks it up automatically)
docker compose exec api python -m salesdw generate
docker compose exec api python -m salesdw status
```

* API docs: http://localhost:8000/docs
* Landing zone: drop files into `./data/incoming/`
* Power BI: PostgreSQL `localhost:5432`, database `sales_dw`, read-only user `powerbi` (password from `.env`) → see [`powerbi/README.md`](powerbi/README.md)

Simulate "tomorrow's" data from a different source system (other headers, `;`
delimiter, `Delivered`/`VOID` status spellings, a new `Loyalty Points` column,
customers changing segment):

```bash
docker compose exec api python -m salesdw generate --increment
```

## Quick start (without Docker)

```bash
pip install -r requirements.txt
export DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/sales_dw
python -m salesdw init-db
python -m salesdw generate            # writes demo files to data/incoming
python -m salesdw run                 # one-off load
python -m salesdw watch               # or: keep loading new files as they arrive
python -m salesdw serve               # REST API on :8000
```

## Feeding it real data

Three ways in, all going through the same pipeline:

1. **Drop a file** into `data/incoming/` (or a sub-folder named after the
   entity, e.g. `data/incoming/orders/`). CSV (any delimiter), Excel, JSON,
   JSON-lines and Parquet are supported. On the cloud VM this is an SFTP target.
2. **Upload through the API**: `curl -H "X-API-Key: …" -F file=@export.xlsx http://host:8000/files`
3. **Push records** from a POS / web-shop webhook:
   ```bash
   curl -H "X-API-Key: …" -H "Content-Type: application/json" http://host:8000/records/orders \
        -d '[{"Invoice No":"A-1001","Date":"2026-01-05","SKU":"P0001","Qty":2,"Price":19.9,"Store":"S001"}]'
   ```

Entities: `orders`, `customers`, `products`, `stores`, `targets`. The file
entity is detected from the folder name, the file name (`orders_*.csv`,
`pos_*`, `crm_*`, `budget_*` …) or from the columns it contains.

### What happens to each file

1. Identical files (same SHA-256) are loaded **once**; re-drops are skipped.
2. Headers are normalised and mapped using `config/schema_mappings.yaml`.
3. Values are cast (`$1,234.50`, `1.234,50`, `15%`, `05 Jan 2026` …) and normalised
   (`Delivered` → `completed`, `visa` → `Card`).
4. Rows that break a rule (missing ID, bad date, unknown currency, ship before
   order, zero quantity …) go to `meta.rejected_rows` with the reason; the rest load.
   If more than 50% of a file is bad, the whole file is moved to `data/failed/`.
5. Rows are staged and merged into the warehouse in a single transaction.
6. The file is archived to `data/processed/<date>/` and the run is logged in `meta.*`.

### Adapting to change (no code changes)

| Change in the business | What you do |
|---|---|
| New source system with different column names | Add aliases in `config/schema_mappings.yaml` |
| Source adds a new column | Nothing — it is stored in `extra_attributes` (JSON) and listed in `meta.schema_drift` / `GET /schema-drift`. Promote it to a real field when it matters. |
| New status / channel / payment spellings | Add them under `value_mappings` |
| New country / currency | Add the FX rate in `config/settings.yaml` |
| Sales arrive before customer/product master data | Handled — an *inferred member* is created and completed when the master data arrives (margins are recalculated) |
| An order changes (e.g. returned later) | Re-send the line; it is updated in place (upsert on order + line) |
| Customer changes segment, product changes price | History is kept (SCD2); old sales keep old attributes and cost |

## Warehouse model

* `dw.fact_sales` — one row per order line: quantity, gross/discount/net sales,
  cost, profit, shipping (all converted to the base currency), status flags.
* `dw.fact_sales_target` — monthly targets per store (`ALL` = company-wide).
* `dw.dim_date`, `dw.dim_customer` (SCD2), `dw.dim_product` (SCD2),
  `dw.dim_store`, `dw.dim_sales_rep`.
* `mart.*` — views for Power BI: star schema with friendly names plus
  `monthly_kpis` (MoM/YoY), `target_vs_actual`, `customer_rfm`,
  `product_performance` (ABC), `pipeline_health`.
* `meta.*` — `etl_runs`, `ingested_files`, `rejected_rows`, `schema_drift`.

## Deploying on Azure (IaaS)

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # allowed IPs, passwords, repo URL
terraform init && terraform apply
```

This creates a resource group, VNet, NSG (SSH / API / PostgreSQL restricted to
your IPs), static public IP, an Ubuntu VM and a separate managed data disk.
Cloud-init installs Docker, clones the repo, starts the stack and schedules
nightly `pg_dump` backups. Point Power BI (through an on-premises data gateway
for scheduled refresh) at the `powerbi_postgres_server` output and sign in as the
read-only `powerbi` user.

## Tests

```bash
export TEST_DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/sales_dw_test   # will be wiped
python -m pytest -q
```

Without `TEST_DATABASE_URL`, only the pure-Python transform tests run.
