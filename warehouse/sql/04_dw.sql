-- ===========================================================================
-- Star schema
--
--                 dim_date
--                    |
--   dim_customer -- fact_sales -- dim_product
--                  /     \
--         dim_store     dim_sales_rep
--              |
--      fact_sales_target (month x store x category)
--
-- dim_customer and dim_product are Slowly Changing Dimensions type 2: when a
-- customer changes segment/city or a product changes price/category a new
-- version row is added, so historical sales keep the attributes that were true
-- when the sale happened. dim_store and dim_sales_rep are type 1 (overwrite).
--
-- Rows flagged is_inferred were created automatically because a sale
-- referenced a customer/product/store that had not been loaded yet
-- ("late-arriving dimension"). They are completed when the real record arrives.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS dw.dim_date (
    date_key       INT PRIMARY KEY,           -- yyyymmdd
    full_date      DATE NOT NULL UNIQUE,
    year           INT  NOT NULL,
    quarter        INT  NOT NULL,
    quarter_label  TEXT NOT NULL,             -- 2025-Q1
    month          INT  NOT NULL,
    month_name     TEXT NOT NULL,
    month_short    TEXT NOT NULL,
    year_month     TEXT NOT NULL,             -- 2025-01
    month_start    DATE NOT NULL,
    iso_week       INT  NOT NULL,
    day_of_month   INT  NOT NULL,
    day_of_week    INT  NOT NULL,             -- 1 = Monday
    day_name       TEXT NOT NULL,
    is_weekend     BOOLEAN NOT NULL
);

-- Adds any missing dates in [from, to]; called by the loader before facts are
-- merged so the calendar always grows with the data.
CREATE OR REPLACE FUNCTION dw.ensure_dates(p_from DATE, p_to DATE) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
    INSERT INTO dw.dim_date
    SELECT to_char(d, 'YYYYMMDD')::INT,
           d::DATE,
           EXTRACT(YEAR FROM d)::INT,
           EXTRACT(QUARTER FROM d)::INT,
           to_char(d, 'YYYY') || '-Q' || EXTRACT(QUARTER FROM d)::INT,
           EXTRACT(MONTH FROM d)::INT,
           trim(to_char(d, 'Month')),
           to_char(d, 'Mon'),
           to_char(d, 'YYYY-MM'),
           date_trunc('month', d)::DATE,
           EXTRACT(WEEK FROM d)::INT,
           EXTRACT(DAY FROM d)::INT,
           EXTRACT(ISODOW FROM d)::INT,
           trim(to_char(d, 'Day')),
           EXTRACT(ISODOW FROM d) IN (6, 7)
    FROM generate_series(p_from, p_to, INTERVAL '1 day') AS d
    ON CONFLICT (date_key) DO NOTHING;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END $$;

CREATE TABLE IF NOT EXISTS dw.dim_customer (
    customer_key     BIGSERIAL PRIMARY KEY,
    customer_id      TEXT NOT NULL,
    customer_name    TEXT,
    email            TEXT,
    segment          TEXT,
    city             TEXT,
    state            TEXT,
    country          TEXT,
    signup_date      DATE,
    extra_attributes JSONB,
    row_hash         TEXT,
    valid_from       DATE NOT NULL,
    valid_to         DATE NOT NULL DEFAULT DATE '9999-12-31',
    is_current       BOOLEAN NOT NULL DEFAULT TRUE,
    is_inferred      BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_dim_customer_current ON dw.dim_customer (customer_id) WHERE is_current;
CREATE INDEX IF NOT EXISTS ix_dim_customer_bk ON dw.dim_customer (customer_id, valid_from);

CREATE TABLE IF NOT EXISTS dw.dim_product (
    product_key      BIGSERIAL PRIMARY KEY,
    product_id       TEXT NOT NULL,
    product_name     TEXT,
    category         TEXT,
    subcategory      TEXT,
    brand            TEXT,
    unit_cost        NUMERIC(14,4),
    list_price       NUMERIC(14,4),
    extra_attributes JSONB,
    row_hash         TEXT,
    valid_from       DATE NOT NULL,
    valid_to         DATE NOT NULL DEFAULT DATE '9999-12-31',
    is_current       BOOLEAN NOT NULL DEFAULT TRUE,
    is_inferred      BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_dim_product_current ON dw.dim_product (product_id) WHERE is_current;
CREATE INDEX IF NOT EXISTS ix_dim_product_bk ON dw.dim_product (product_id, valid_from);

CREATE TABLE IF NOT EXISTS dw.dim_store (
    store_key        BIGSERIAL PRIMARY KEY,
    store_id         TEXT NOT NULL UNIQUE,
    store_name       TEXT,
    channel          TEXT,
    city             TEXT,
    region           TEXT,
    country          TEXT,
    opened_date      DATE,
    extra_attributes JSONB,
    is_inferred      BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dw.dim_sales_rep (
    sales_rep_key    BIGSERIAL PRIMARY KEY,
    sales_rep_name   TEXT NOT NULL UNIQUE,
    first_sale_date  DATE,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dw.fact_sales (
    sales_key          BIGSERIAL PRIMARY KEY,
    order_id           TEXT NOT NULL,
    line_number        INT  NOT NULL,
    order_date_key     INT  NOT NULL REFERENCES dw.dim_date(date_key),
    ship_date_key      INT  REFERENCES dw.dim_date(date_key),
    customer_key       BIGINT NOT NULL REFERENCES dw.dim_customer(customer_key),
    product_key        BIGINT NOT NULL REFERENCES dw.dim_product(product_key),
    store_key          BIGINT NOT NULL REFERENCES dw.dim_store(store_key),
    sales_rep_key      BIGINT NOT NULL REFERENCES dw.dim_sales_rep(sales_rep_key),
    order_status       TEXT NOT NULL,
    payment_method     TEXT,
    currency           TEXT NOT NULL,
    fx_rate            NUMERIC(14,8) NOT NULL,
    quantity           NUMERIC(14,4) NOT NULL,
    unit_price         NUMERIC(14,4) NOT NULL,   -- in order currency
    discount_rate      NUMERIC(8,6)  NOT NULL,
    -- all amounts below are in the base (reporting) currency
    gross_amount       NUMERIC(16,4) NOT NULL,
    discount_amount    NUMERIC(16,4) NOT NULL,
    net_amount         NUMERIC(16,4) NOT NULL,
    cost_amount        NUMERIC(16,4) NOT NULL,
    shipping_cost      NUMERIC(16,4) NOT NULL,
    profit_amount      NUMERIC(16,4) NOT NULL,
    is_revenue         BOOLEAN NOT NULL,         -- counts toward sales (completed / pending)
    is_returned        BOOLEAN NOT NULL,
    is_cancelled       BOOLEAN NOT NULL,
    days_to_ship       INT,
    extra_attributes   JSONB,
    batch_id           TEXT,
    loaded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (order_id, line_number)
);
CREATE INDEX IF NOT EXISTS ix_fact_sales_date     ON dw.fact_sales (order_date_key);
CREATE INDEX IF NOT EXISTS ix_fact_sales_customer ON dw.fact_sales (customer_key);
CREATE INDEX IF NOT EXISTS ix_fact_sales_product  ON dw.fact_sales (product_key);
CREATE INDEX IF NOT EXISTS ix_fact_sales_store    ON dw.fact_sales (store_key);

CREATE TABLE IF NOT EXISTS dw.fact_sales_target (
    target_key     BIGSERIAL PRIMARY KEY,
    month_date_key INT  NOT NULL REFERENCES dw.dim_date(date_key),   -- first day of month
    store_id       TEXT NOT NULL,   -- 'ALL' = company-wide target
    category       TEXT NOT NULL,   -- 'ALL' = all categories
    target_amount  NUMERIC(16,2) NOT NULL,
    batch_id       TEXT,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (month_date_key, store_id, category)
);

-- Seed the calendar with a sensible default range; it is extended automatically.
SELECT dw.ensure_dates(DATE '2020-01-01', DATE '2027-12-31');
