-- SCD type 2 merge of the current batch into dw.dim_customer.
CREATE TEMP TABLE src ON COMMIT DROP AS
SELECT DISTINCT ON (customer_id)
       customer_id, customer_name, email, segment, city, state, country, signup_date, extra_attributes,
       md5(concat_ws('|', customer_name, email, segment, city, state, country, signup_date::TEXT)) AS row_hash
FROM staging.stg_customers
WHERE batch_id = :batch_id
ORDER BY customer_id, stg_row DESC;

-- 1) Inferred members (created by an earlier sale) are completed in place.
UPDATE dw.dim_customer d
SET customer_name = s.customer_name, email = s.email, segment = s.segment, city = s.city,
    state = s.state, country = s.country, signup_date = s.signup_date,
    extra_attributes = s.extra_attributes, row_hash = s.row_hash,
    is_inferred = FALSE, updated_at = now()
FROM src s
WHERE d.customer_id = s.customer_id AND d.is_current AND d.is_inferred;

-- 2) Attributes-only changes in the free-form extra columns: overwrite (type 1).
UPDATE dw.dim_customer d
SET extra_attributes = s.extra_attributes, updated_at = now()
FROM src s
WHERE d.customer_id = s.customer_id AND d.is_current AND d.row_hash = s.row_hash
  AND d.extra_attributes IS DISTINCT FROM s.extra_attributes;

-- 3) Tracked attributes changed: expire the current version...
UPDATE dw.dim_customer d
SET valid_to = CURRENT_DATE, is_current = FALSE, updated_at = now()
FROM src s
WHERE d.customer_id = s.customer_id AND d.is_current AND d.row_hash <> s.row_hash;

-- 4) ...and insert a new version (or the very first one).
INSERT INTO dw.dim_customer (customer_id, customer_name, email, segment, city, state, country,
                             signup_date, extra_attributes, row_hash, valid_from)
SELECT s.customer_id, s.customer_name, s.email, s.segment, s.city, s.state, s.country,
       s.signup_date, s.extra_attributes, s.row_hash,
       CASE WHEN EXISTS (SELECT 1 FROM dw.dim_customer x WHERE x.customer_id = s.customer_id)
            THEN CURRENT_DATE ELSE DATE '1900-01-01' END
FROM src s
WHERE NOT EXISTS (SELECT 1 FROM dw.dim_customer d WHERE d.customer_id = s.customer_id AND d.is_current);
