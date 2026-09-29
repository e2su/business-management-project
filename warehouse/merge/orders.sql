-- Merge order lines into dw.fact_sales (insert new lines, update changed ones,
-- e.g. an order that moved from 'pending' to 'returned').
CREATE TEMP TABLE src ON COMMIT DROP AS
SELECT DISTINCT ON (order_id, line_number) *
FROM staging.stg_orders
WHERE batch_id = :batch_id
ORDER BY order_id, line_number, stg_row DESC;

-- Calendar must cover all dates in the batch.
SELECT dw.ensure_dates(LEAST(min(order_date), min(ship_date)), GREATEST(max(order_date), max(ship_date)))
FROM src;

-- Late-arriving dimensions: create inferred members for unknown keys so no
-- sale is ever dropped. They are completed when the master data arrives.
INSERT INTO dw.dim_customer (customer_id, customer_name, segment, country, valid_from, is_inferred)
SELECT DISTINCT s.customer_id,
       CASE WHEN s.customer_id = 'GUEST' THEN 'Guest / Walk-in' ELSE 'Unknown customer ' || s.customer_id END,
       'Unassigned', 'Unknown', DATE '1900-01-01', s.customer_id <> 'GUEST'
FROM src s
WHERE NOT EXISTS (SELECT 1 FROM dw.dim_customer d WHERE d.customer_id = s.customer_id);

INSERT INTO dw.dim_product (product_id, product_name, category, subcategory, brand, unit_cost, list_price, valid_from, is_inferred)
SELECT s.product_id, 'Unknown product ' || s.product_id, 'Uncategorized', 'General', 'Generic', 0, max(s.unit_price),
       DATE '1900-01-01', TRUE
FROM src s
WHERE NOT EXISTS (SELECT 1 FROM dw.dim_product d WHERE d.product_id = s.product_id)
GROUP BY s.product_id;

INSERT INTO dw.dim_store (store_id, store_name, channel, region, country, is_inferred)
SELECT DISTINCT s.store_id,
       CASE WHEN s.store_id = 'ONLINE' THEN 'Online Store' ELSE 'Unknown store ' || s.store_id END,
       CASE WHEN s.store_id = 'ONLINE' THEN 'Online' ELSE 'Unknown' END,
       'Unassigned', 'Unknown', s.store_id <> 'ONLINE'
FROM src s
ON CONFLICT (store_id) DO NOTHING;

INSERT INTO dw.dim_sales_rep (sales_rep_name, first_sale_date)
SELECT s.sales_rep, min(s.order_date) FROM src s GROUP BY s.sales_rep
ON CONFLICT (sales_rep_name) DO UPDATE
SET first_sale_date = LEAST(dw.dim_sales_rep.first_sale_date, EXCLUDED.first_sale_date), updated_at = now();

-- Resolve surrogate keys. Customer and product use the version that was valid
-- on the order date (point-in-time lookup), so cost/segment are historical.
INSERT INTO dw.fact_sales AS f (
    order_id, line_number, order_date_key, ship_date_key, customer_key, product_key, store_key,
    sales_rep_key, order_status, payment_method, currency, fx_rate, quantity, unit_price,
    discount_rate, gross_amount, discount_amount, net_amount, cost_amount, shipping_cost,
    profit_amount, is_revenue, is_returned, is_cancelled, days_to_ship, extra_attributes, batch_id)
SELECT
    s.order_id, s.line_number,
    to_char(s.order_date, 'YYYYMMDD')::INT,
    CASE WHEN s.ship_date IS NOT NULL THEN to_char(s.ship_date, 'YYYYMMDD')::INT END,
    c.customer_key, p.product_key, st.store_key, r.sales_rep_key,
    s.order_status, s.payment_method, s.currency, s.fx_rate, s.quantity, s.unit_price, s.discount,
    round(s.quantity * s.unit_price * s.fx_rate, 4)                                   AS gross_amount,
    round(s.quantity * s.unit_price * s.discount * s.fx_rate, 4)                      AS discount_amount,
    round(s.quantity * s.unit_price * (1 - s.discount) * s.fx_rate, 4)                AS net_amount,
    round(s.quantity * COALESCE(p.unit_cost, 0), 4)                                   AS cost_amount,
    round(s.shipping_cost * s.fx_rate, 4)                                             AS shipping_cost,
    round(s.quantity * s.unit_price * (1 - s.discount) * s.fx_rate
          - s.quantity * COALESCE(p.unit_cost, 0), 4)                                 AS profit_amount,
    s.order_status IN ('completed', 'pending'),
    s.order_status = 'returned',
    s.order_status = 'cancelled',
    CASE WHEN s.ship_date IS NOT NULL THEN s.ship_date - s.order_date END,
    s.extra_attributes, s.batch_id
FROM src s
CROSS JOIN LATERAL (
    SELECT d.customer_key FROM dw.dim_customer d
    WHERE d.customer_id = s.customer_id
    ORDER BY (s.order_date >= d.valid_from AND s.order_date < d.valid_to) DESC, d.is_current DESC, d.valid_from DESC
    LIMIT 1) c
CROSS JOIN LATERAL (
    SELECT d.product_key, d.unit_cost FROM dw.dim_product d
    WHERE d.product_id = s.product_id
    ORDER BY (s.order_date >= d.valid_from AND s.order_date < d.valid_to) DESC, d.is_current DESC, d.valid_from DESC
    LIMIT 1) p
JOIN dw.dim_store st     ON st.store_id = s.store_id
JOIN dw.dim_sales_rep r  ON r.sales_rep_name = s.sales_rep
ON CONFLICT (order_id, line_number) DO UPDATE SET
    order_date_key = EXCLUDED.order_date_key, ship_date_key = EXCLUDED.ship_date_key,
    customer_key = EXCLUDED.customer_key, product_key = EXCLUDED.product_key,
    store_key = EXCLUDED.store_key, sales_rep_key = EXCLUDED.sales_rep_key,
    order_status = EXCLUDED.order_status, payment_method = EXCLUDED.payment_method,
    currency = EXCLUDED.currency, fx_rate = EXCLUDED.fx_rate, quantity = EXCLUDED.quantity,
    unit_price = EXCLUDED.unit_price, discount_rate = EXCLUDED.discount_rate,
    gross_amount = EXCLUDED.gross_amount, discount_amount = EXCLUDED.discount_amount,
    net_amount = EXCLUDED.net_amount, cost_amount = EXCLUDED.cost_amount,
    shipping_cost = EXCLUDED.shipping_cost, profit_amount = EXCLUDED.profit_amount,
    is_revenue = EXCLUDED.is_revenue, is_returned = EXCLUDED.is_returned,
    is_cancelled = EXCLUDED.is_cancelled, days_to_ship = EXCLUDED.days_to_ship,
    extra_attributes = EXCLUDED.extra_attributes, batch_id = EXCLUDED.batch_id, updated_at = now();
