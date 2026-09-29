-- Staging tables receive already-typed, already-mapped rows from the Python
-- transform step. Each load writes a batch_id; the merge step consumes that
-- batch and then deletes it, so staging stays small.

CREATE TABLE IF NOT EXISTS staging.stg_customers (
    stg_row          BIGSERIAL,
    batch_id         TEXT NOT NULL,
    customer_id      TEXT NOT NULL,
    customer_name    TEXT,
    email            TEXT,
    segment          TEXT,
    city             TEXT,
    state            TEXT,
    country          TEXT,
    signup_date      DATE,
    extra_attributes JSONB
);

CREATE TABLE IF NOT EXISTS staging.stg_products (
    stg_row          BIGSERIAL,
    batch_id         TEXT NOT NULL,
    product_id       TEXT NOT NULL,
    product_name     TEXT,
    category         TEXT,
    subcategory      TEXT,
    brand            TEXT,
    unit_cost        NUMERIC(14,4),
    list_price       NUMERIC(14,4),
    extra_attributes JSONB
);

CREATE TABLE IF NOT EXISTS staging.stg_stores (
    stg_row          BIGSERIAL,
    batch_id         TEXT NOT NULL,
    store_id         TEXT NOT NULL,
    store_name       TEXT,
    channel          TEXT,
    city             TEXT,
    region           TEXT,
    country          TEXT,
    opened_date      DATE,
    extra_attributes JSONB
);

CREATE TABLE IF NOT EXISTS staging.stg_orders (
    stg_row          BIGSERIAL,
    batch_id         TEXT NOT NULL,
    order_id         TEXT NOT NULL,
    line_number      INT  NOT NULL,
    order_date       DATE NOT NULL,
    ship_date        DATE,
    customer_id      TEXT,
    product_id       TEXT NOT NULL,
    store_id         TEXT,
    sales_rep        TEXT,
    quantity         NUMERIC(14,4),
    unit_price       NUMERIC(14,4),
    discount         NUMERIC(8,6),
    shipping_cost    NUMERIC(14,4),
    payment_method   TEXT,
    order_status     TEXT,
    currency         TEXT,
    fx_rate          NUMERIC(14,8),
    extra_attributes JSONB
);

CREATE TABLE IF NOT EXISTS staging.stg_targets (
    stg_row          BIGSERIAL,
    batch_id         TEXT NOT NULL,
    target_month     DATE NOT NULL,
    store_id         TEXT NOT NULL,
    category         TEXT NOT NULL,
    target_amount    NUMERIC(16,2),
    extra_attributes JSONB
);
