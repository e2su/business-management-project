SELECT dw.ensure_dates(
    (SELECT min(target_month) FROM staging.stg_targets WHERE batch_id = :batch_id),
    (SELECT max(target_month) FROM staging.stg_targets WHERE batch_id = :batch_id));

INSERT INTO dw.fact_sales_target (month_date_key, store_id, category, target_amount, batch_id)
SELECT DISTINCT ON (target_month, store_id, category)
       to_char(target_month, 'YYYYMMDD')::INT, store_id, category, target_amount, batch_id
FROM staging.stg_targets
WHERE batch_id = :batch_id
ORDER BY target_month, store_id, category, stg_row DESC
ON CONFLICT (month_date_key, store_id, category) DO UPDATE
SET target_amount = EXCLUDED.target_amount, batch_id = EXCLUDED.batch_id, updated_at = now();
