CREATE TABLE IF NOT EXISTS meta.etl_runs (
    run_id          BIGSERIAL PRIMARY KEY,
    trigger         TEXT        NOT NULL DEFAULT 'manual',   -- manual | watcher | api
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    status          TEXT        NOT NULL DEFAULT 'running',  -- running | success | partial | failed
    files_processed INT         NOT NULL DEFAULT 0,
    rows_loaded     INT         NOT NULL DEFAULT 0,
    rows_rejected   INT         NOT NULL DEFAULT 0,
    message         TEXT
);

CREATE TABLE IF NOT EXISTS meta.ingested_files (
    file_id       BIGSERIAL PRIMARY KEY,
    run_id        BIGINT REFERENCES meta.etl_runs(run_id),
    file_name     TEXT        NOT NULL,
    checksum      TEXT        NOT NULL,
    entity        TEXT,
    rows_read     INT         NOT NULL DEFAULT 0,
    rows_loaded   INT         NOT NULL DEFAULT 0,
    rows_rejected INT         NOT NULL DEFAULT 0,
    status        TEXT        NOT NULL,                      -- loaded | failed | skipped
    message       TEXT,
    ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- A file with identical content is only ever loaded once (idempotent re-drops).
CREATE UNIQUE INDEX IF NOT EXISTS ux_ingested_files_checksum
    ON meta.ingested_files (checksum) WHERE status = 'loaded';

CREATE TABLE IF NOT EXISTS meta.rejected_rows (
    reject_id   BIGSERIAL PRIMARY KEY,
    run_id      BIGINT REFERENCES meta.etl_runs(run_id),
    file_name   TEXT,
    entity      TEXT,
    row_number  INT,
    reason      TEXT,
    payload     JSONB,
    rejected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- New columns that appeared in source files but are not (yet) mapped.
CREATE TABLE IF NOT EXISTS meta.schema_drift (
    entity          TEXT NOT NULL,
    column_name     TEXT NOT NULL,
    first_seen_file TEXT,
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    times_seen      INT NOT NULL DEFAULT 1,
    PRIMARY KEY (entity, column_name)
);
