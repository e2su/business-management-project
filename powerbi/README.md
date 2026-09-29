# Power BI dashboard guide

Power BI connects to the **`mart`** schema of the warehouse. Everything in that
schema is a view with business-friendly column names, so the report is
insulated from changes in the ETL and `dw` tables.

## 1. Connect

1. Power BI Desktop → **Get data → PostgreSQL database**
   * Server: `localhost:5432` (Docker) or `<vm-public-ip>:5432` (cloud VM)
   * Database: `sales_dw`
   * Data connectivity mode:
     * **Import** — fastest visuals; refresh on a schedule (up to 8×/day on Pro, 48×/day on Premium).
     * **DirectQuery** — every visual queries the warehouse live, so new files dropped
       into the landing zone show up within one watcher interval (~30 s). Use this for the
       "live operations" page.
2. Sign in with the database user from `.env` (use a read-only user in production, see below).
3. In the Navigator pick these views:

| View                      | Rename to   | Purpose                               |
|---------------------------|-------------|---------------------------------------|
| `mart.fact_sales`         | Sales       | one row per order line                |
| `mart.fact_sales_target`  | Targets     | monthly targets per store             |
| `mart.dim_date`           | Date        | calendar                              |
| `mart.dim_customer`       | Customer    | customers (all SCD2 versions)         |
| `mart.dim_product`        | Product     | products (all SCD2 versions)          |
| `mart.dim_store`          | Store       | stores / channels / regions           |
| `mart.dim_sales_rep`      | Sales Rep   | sales people                          |
| `mart.monthly_kpis`       | Monthly KPIs | pre-aggregated KPI table              |
| `mart.customer_rfm`       | Customer RFM | RFM segmentation                      |
| `mart.product_performance`| Product Performance | ABC analysis                  |
| `mart.target_vs_actual`   | Target vs Actual | variance per store/month          |
| `mart.pipeline_health`    | Pipeline Health | ETL run log / data freshness       |

## 2. Model (Model view)

Create single-direction, many-to-one relationships:

```
Sales[order_date_key]  → Date[date_key]          (active)
Sales[ship_date_key]   → Date[date_key]          (inactive – use USERELATIONSHIP)
Sales[customer_key]    → Customer[customer_key]
Sales[product_key]     → Product[product_key]
Sales[store_key]       → Store[store_key]
Sales[sales_rep_key]   → Sales Rep[sales_rep_key]
Targets[month_date_key]→ Date[date_key]
Targets[store_key]     → Store[store_key]
```

* **Mark `Date` as date table** (Table tools → Mark as date table → `Date`).
* Sort `Date[Month]` by `Date[Month Number]`, `Date[Weekday]` by `Date[Weekday Number]`.
* Hide all `*_key` columns from report view.
* Create the measures in [`measures.dax`](measures.dax) in a `_Measures` table.
* View → Themes → Browse → [`theme.json`](theme.json).

Because customers/products are SCD type 2, a sale is linked to the version that
was valid on the order date. Slicing by `Customer[Segment]` shows revenue under
the segment the customer had *at the time of the sale*. To slice by *today's*
attributes, filter `Customer[Is Current Version] = TRUE` on the dimension-only
visuals or use `Customer RFM` (which is always current).

## 3. Suggested report pages

1. **Executive overview** — KPI cards (Net Sales, Profit, Margin %, Orders, AOV,
   Net Sales YoY %), line chart Net Sales vs Net Sales PY by month, bar of Net
   Sales by Region, gauge of Target Attainment %, data-freshness card
   (`Data Freshness Label`).
2. **Sales performance** — matrix Region → Store with Net Sales, Target,
   Target Attainment % (conditional formatting on `Target Status`), channel
   donut, weekday × month heatmap.
3. **Products** — ABC class treemap from `Product Performance`, top-N products
   by `Product Rank`, margin % by category/subcategory scatter (Net Sales vs Margin %).
4. **Customers** — RFM segment bar, New vs Returning customers over time,
   Sales per Customer by Segment, map by Country.
5. **Sales team** — Sales Rep leaderboard (`Sales Rep Rank`), AOV and discount
   rate per rep (spot over-discounting).
6. **Operations / returns** — Return Rate and Cancelled Orders trend, Avg Days
   to Ship by channel, payment method mix.
7. **Data pipeline health** — table of `Pipeline Health` (status, rows loaded,
   rows rejected), card with last load time. Useful for the admin team.

## 4. Keeping it live

* **Local / on-premises**: install the *On-premises data gateway* on the machine
  (or VM) that can reach PostgreSQL, publish the report to the Power BI
  Service, add the data source to the gateway and set **Scheduled refresh**.
* **DirectQuery pages** need no refresh schedule — they read the warehouse live.
* New columns that appear in source files land in `extra_attributes` (JSON) and
  in `meta.schema_drift`. To surface one in Power BI, add it as an alias/field in
  `config/schema_mappings.yaml` (and a column in the warehouse/view), or expand it
  in Power Query: `Json.Document([extra_attributes])`.

## 5. Read-only reporting user (recommended)

```sql
CREATE ROLE powerbi LOGIN PASSWORD 'choose-a-strong-password';
GRANT USAGE ON SCHEMA mart TO powerbi;
GRANT SELECT ON ALL TABLES IN SCHEMA mart TO powerbi;
ALTER DEFAULT PRIVILEGES IN SCHEMA mart GRANT SELECT ON TABLES TO powerbi;
-- views read dw/meta with the owner's rights, so no grants on those schemas are needed
```
