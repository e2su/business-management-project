-- SCD type 2 merge of the current batch into dw.dim_product.
CREATE TEMP TABLE src ON COMMIT DROP AS
SELECT DISTINCT ON (product_id)
       product_id, product_name, category, subcategory, brand, unit_cost, list_price, extra_attributes,
       md5(concat_ws('|', product_name, category, subcategory, brand, unit_cost::TEXT, list_price::TEXT)) AS row_hash
FROM staging.stg_products
WHERE batch_id = :batch_id
ORDER BY product_id, stg_row DESC;

-- Sales loaded against an inferred product had no cost yet: fix their margin.
UPDATE dw.fact_sales f
SET cost_amount = round(f.quantity * COALESCE(s.unit_cost, 0), 4),
    profit_amount = round(f.net_amount - f.quantity * COALESCE(s.unit_cost, 0), 4),
    updated_at = now()
FROM dw.dim_product d
JOIN src s ON s.product_id = d.product_id
WHERE f.product_key = d.product_key AND d.is_current AND d.is_inferred;

UPDATE dw.dim_product d
SET product_name = s.product_name, category = s.category, subcategory = s.subcategory, brand = s.brand,
    unit_cost = s.unit_cost, list_price = s.list_price, extra_attributes = s.extra_attributes,
    row_hash = s.row_hash, is_inferred = FALSE, updated_at = now()
FROM src s
WHERE d.product_id = s.product_id AND d.is_current AND d.is_inferred;

UPDATE dw.dim_product d
SET extra_attributes = s.extra_attributes, updated_at = now()
FROM src s
WHERE d.product_id = s.product_id AND d.is_current AND d.row_hash = s.row_hash
  AND d.extra_attributes IS DISTINCT FROM s.extra_attributes;

UPDATE dw.dim_product d
SET valid_to = CURRENT_DATE, is_current = FALSE, updated_at = now()
FROM src s
WHERE d.product_id = s.product_id AND d.is_current AND d.row_hash <> s.row_hash;

INSERT INTO dw.dim_product (product_id, product_name, category, subcategory, brand, unit_cost,
                            list_price, extra_attributes, row_hash, valid_from)
SELECT s.product_id, s.product_name, s.category, s.subcategory, s.brand, s.unit_cost,
       s.list_price, s.extra_attributes, s.row_hash,
       CASE WHEN EXISTS (SELECT 1 FROM dw.dim_product x WHERE x.product_id = s.product_id)
            THEN CURRENT_DATE ELSE DATE '1900-01-01' END
FROM src s
WHERE NOT EXISTS (SELECT 1 FROM dw.dim_product d WHERE d.product_id = s.product_id AND d.is_current);
