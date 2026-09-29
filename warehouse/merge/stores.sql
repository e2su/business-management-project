-- Type 1 (overwrite) merge into dw.dim_store.
INSERT INTO dw.dim_store AS d (store_id, store_name, channel, city, region, country, opened_date, extra_attributes)
SELECT DISTINCT ON (store_id)
       store_id, store_name, channel, city, region, country, opened_date, extra_attributes
FROM staging.stg_stores
WHERE batch_id = :batch_id
ORDER BY store_id, stg_row DESC
ON CONFLICT (store_id) DO UPDATE
SET store_name = EXCLUDED.store_name, channel = EXCLUDED.channel, city = EXCLUDED.city,
    region = EXCLUDED.region, country = EXCLUDED.country, opened_date = EXCLUDED.opened_date,
    extra_attributes = EXCLUDED.extra_attributes, is_inferred = FALSE, updated_at = now();
