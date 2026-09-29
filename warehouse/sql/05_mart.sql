-- ===========================================================================
-- Mart layer: what Power BI connects to.
--
-- * mart.dim_* / mart.fact_* are the star schema, with friendly column names.
--   Import these into Power BI and create relationships on the *_key columns.
-- * The remaining views are pre-aggregated analytics (KPIs, RFM, ABC, targets)
--   that are easier to express in SQL than in DAX.
--
-- Views are recreated on every `salesdw init-db`, so you can change them freely.
-- ===========================================================================

CREATE OR REPLACE VIEW mart.dim_date AS
SELECT date_key, full_date AS "Date", year AS "Year", quarter AS "Quarter", quarter_label AS "Year Quarter",
       month AS "Month Number", month_name AS "Month", month_short AS "Month Short", year_month AS "Year Month",
       month_start AS "Month Start", iso_week AS "Week", day_of_month AS "Day", day_of_week AS "Weekday Number",
       day_name AS "Weekday", is_weekend AS "Is Weekend"
FROM dw.dim_date;

CREATE OR REPLACE VIEW mart.dim_customer AS
SELECT customer_key, customer_id AS "Customer ID", customer_name AS "Customer", email AS "Email",
       segment AS "Segment", city AS "City", state AS "State", country AS "Country",
       signup_date AS "Signup Date", is_current AS "Is Current Version", is_inferred AS "Is Inferred",
       valid_from AS "Valid From", valid_to AS "Valid To"
FROM dw.dim_customer;

CREATE OR REPLACE VIEW mart.dim_product AS
SELECT product_key, product_id AS "Product ID", product_name AS "Product", category AS "Category",
       subcategory AS "Subcategory", brand AS "Brand", unit_cost AS "Unit Cost", list_price AS "List Price",
       is_current AS "Is Current Version", is_inferred AS "Is Inferred"
FROM dw.dim_product;

CREATE OR REPLACE VIEW mart.dim_store AS
SELECT store_key, store_id AS "Store ID", store_name AS "Store", channel AS "Channel", city AS "City",
       region AS "Region", country AS "Country", opened_date AS "Opened Date", is_inferred AS "Is Inferred"
FROM dw.dim_store;

CREATE OR REPLACE VIEW mart.dim_sales_rep AS
SELECT sales_rep_key, sales_rep_name AS "Sales Rep", first_sale_date AS "First Sale Date"
FROM dw.dim_sales_rep;

CREATE OR REPLACE VIEW mart.fact_sales AS
SELECT sales_key, order_id AS "Order ID", line_number AS "Line", order_date_key, ship_date_key,
       customer_key, product_key, store_key, sales_rep_key,
       order_status AS "Order Status", payment_method AS "Payment Method", currency AS "Currency",
       quantity AS "Quantity", gross_amount AS "Gross Sales", discount_amount AS "Discount",
       net_amount AS "Net Sales", cost_amount AS "Cost", profit_amount AS "Profit",
       shipping_cost AS "Shipping Cost", is_revenue AS "Is Revenue", is_returned AS "Is Returned",
       is_cancelled AS "Is Cancelled", days_to_ship AS "Days To Ship", loaded_at AS "Loaded At"
FROM dw.fact_sales;

CREATE OR REPLACE VIEW mart.fact_sales_target AS
SELECT t.month_date_key, t.store_id AS "Store ID", t.category AS "Category",
       st.store_key, t.target_amount AS "Target"
FROM dw.fact_sales_target t
LEFT JOIN dw.dim_store st ON st.store_id = t.store_id;

-- Monthly company KPIs with month-over-month and year-over-year growth.
CREATE OR REPLACE VIEW mart.monthly_kpis AS
WITH m AS (
    SELECT d.month_start,
           sum(f.net_amount)    FILTER (WHERE f.is_revenue)  AS net_sales,
           sum(f.profit_amount) FILTER (WHERE f.is_revenue)  AS profit,
           sum(f.quantity)      FILTER (WHERE f.is_revenue)  AS units,
           count(DISTINCT f.order_id)    FILTER (WHERE f.is_revenue) AS orders,
           count(DISTINCT f.customer_key) FILTER (WHERE f.is_revenue) AS active_customers,
           sum(f.net_amount)    FILTER (WHERE f.is_returned) AS returned_sales,
           count(DISTINCT f.order_id)    FILTER (WHERE f.is_cancelled) AS cancelled_orders
    FROM dw.fact_sales f
    JOIN dw.dim_date d ON d.date_key = f.order_date_key
    GROUP BY d.month_start
)
SELECT month_start AS "Month",
       net_sales AS "Net Sales",
       profit AS "Profit",
       round(profit / NULLIF(net_sales, 0), 4) AS "Margin %",
       units AS "Units",
       orders AS "Orders",
       active_customers AS "Active Customers",
       round(net_sales / NULLIF(orders, 0), 2) AS "Avg Order Value",
       COALESCE(returned_sales, 0) AS "Returned Sales",
       round(COALESCE(returned_sales, 0) / NULLIF(net_sales + COALESCE(returned_sales, 0), 0), 4) AS "Return Rate",
       COALESCE(cancelled_orders, 0) AS "Cancelled Orders",
       round(net_sales / NULLIF(lag(net_sales) OVER (ORDER BY month_start), 0) - 1, 4) AS "MoM Growth",
       round(net_sales / NULLIF((SELECT p.net_sales FROM m p WHERE p.month_start = (m.month_start - INTERVAL '1 year')::DATE), 0) - 1, 4) AS "YoY Growth"
FROM m;

-- Target vs actual per month / store / category. 'ALL' rows roll up.
CREATE OR REPLACE VIEW mart.target_vs_actual AS
WITH actual AS (
    SELECT d.month_start, s.store_id, p.category, sum(f.net_amount) AS net_sales
    FROM dw.fact_sales f
    JOIN dw.dim_date d    ON d.date_key = f.order_date_key
    JOIN dw.dim_store s   ON s.store_key = f.store_key
    JOIN dw.dim_product p ON p.product_key = f.product_key
    WHERE f.is_revenue
    GROUP BY GROUPING SETS ((d.month_start, s.store_id, p.category), (d.month_start, s.store_id),
                            (d.month_start, p.category), (d.month_start))
)
SELECT dd.month_start AS "Month",
       t.store_id AS "Store ID",
       COALESCE(st.store_name, 'All stores') AS "Store",
       COALESCE(st.region, 'All regions') AS "Region",
       t.category AS "Category",
       t.target_amount AS "Target",
       COALESCE(a.net_sales, 0) AS "Actual",
       COALESCE(a.net_sales, 0) - t.target_amount AS "Variance",
       round(COALESCE(a.net_sales, 0) / NULLIF(t.target_amount, 0), 4) AS "Attainment %"
FROM dw.fact_sales_target t
JOIN dw.dim_date dd ON dd.date_key = t.month_date_key
LEFT JOIN dw.dim_store st ON st.store_id = t.store_id
LEFT JOIN actual a
       ON a.month_start = dd.month_start
      AND a.store_id IS NOT DISTINCT FROM NULLIF(t.store_id, 'ALL')
      AND a.category IS NOT DISTINCT FROM NULLIF(t.category, 'ALL');

-- RFM customer segmentation (Recency, Frequency, Monetary), scored 1-5.
CREATE OR REPLACE VIEW mart.customer_rfm AS
WITH base AS (
    SELECT c.customer_id,
           max(d.full_date)            AS last_order_date,
           count(DISTINCT f.order_id)  AS frequency,
           sum(f.net_amount)           AS monetary
    FROM dw.fact_sales f
    JOIN dw.dim_customer c ON c.customer_key = f.customer_key
    JOIN dw.dim_date d     ON d.date_key = f.order_date_key
    WHERE f.is_revenue AND c.customer_id <> 'GUEST'
    GROUP BY c.customer_id
), scored AS (
    SELECT b.*,
           (SELECT max(full_date) FROM dw.dim_date dd JOIN dw.fact_sales ff ON ff.order_date_key = dd.date_key) - last_order_date AS recency_days,
           ntile(5) OVER (ORDER BY last_order_date)   AS r_score,
           ntile(5) OVER (ORDER BY frequency)         AS f_score,
           ntile(5) OVER (ORDER BY monetary)          AS m_score
    FROM base b
)
SELECT s.customer_id AS "Customer ID", cur.customer_name AS "Customer", cur.segment AS "Segment",
       cur.country AS "Country", s.last_order_date AS "Last Order Date", s.recency_days AS "Recency Days",
       s.frequency AS "Orders", s.monetary AS "Lifetime Net Sales",
       s.r_score AS "R", s.f_score AS "F", s.m_score AS "M",
       CASE
           WHEN s.r_score >= 4 AND s.f_score >= 4 AND s.m_score >= 4 THEN 'Champions'
           WHEN s.r_score >= 3 AND s.f_score >= 3                    THEN 'Loyal'
           WHEN s.r_score >= 4 AND s.f_score <= 2                    THEN 'New / Promising'
           WHEN s.r_score <= 2 AND s.f_score >= 3                    THEN 'At Risk'
           WHEN s.r_score <= 2 AND s.f_score <= 2                    THEN 'Hibernating'
           ELSE 'Needs Attention'
       END AS "RFM Segment"
FROM scored s
JOIN dw.dim_customer cur ON cur.customer_id = s.customer_id AND cur.is_current;

-- Product performance with ABC classification (A = top 80% of revenue).
CREATE OR REPLACE VIEW mart.product_performance AS
WITH p AS (
    SELECT dp.product_id,
           sum(f.net_amount)    AS net_sales,
           sum(f.profit_amount) AS profit,
           sum(f.quantity)      AS units,
           count(DISTINCT f.order_id) AS orders
    FROM dw.fact_sales f
    JOIN dw.dim_product dp ON dp.product_key = f.product_key
    WHERE f.is_revenue
    GROUP BY dp.product_id
), ranked AS (
    SELECT p.*,
           rank() OVER (ORDER BY net_sales DESC) AS sales_rank,
           sum(net_sales) OVER (ORDER BY net_sales DESC, product_id ROWS UNBOUNDED PRECEDING)
             / NULLIF(sum(net_sales) OVER (), 0) AS cumulative_share
    FROM p
)
SELECT r.product_id AS "Product ID", cur.product_name AS "Product", cur.category AS "Category",
       cur.subcategory AS "Subcategory", cur.brand AS "Brand",
       r.net_sales AS "Net Sales", r.profit AS "Profit", round(r.profit / NULLIF(r.net_sales, 0), 4) AS "Margin %",
       r.units AS "Units", r.orders AS "Orders", r.sales_rank AS "Sales Rank",
       round(r.cumulative_share, 4) AS "Cumulative Share",
       CASE WHEN r.cumulative_share <= 0.8 THEN 'A' WHEN r.cumulative_share <= 0.95 THEN 'B' ELSE 'C' END AS "ABC Class"
FROM ranked r
JOIN dw.dim_product cur ON cur.product_id = r.product_id AND cur.is_current;

-- Data freshness / pipeline health page in Power BI.
CREATE OR REPLACE VIEW mart.pipeline_health AS
SELECT r.run_id AS "Run ID", r.trigger AS "Trigger", r.started_at AS "Started At", r.finished_at AS "Finished At",
       r.status AS "Status", r.files_processed AS "Files", r.rows_loaded AS "Rows Loaded",
       r.rows_rejected AS "Rows Rejected", r.message AS "Message",
       (SELECT max(loaded_at) FROM dw.fact_sales) AS "Latest Sales Load"
FROM meta.etl_runs r;
