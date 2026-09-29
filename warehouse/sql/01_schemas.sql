-- Layers of the warehouse
--   staging : raw rows of the current load batch (transient)
--   dw      : the star schema (conformed dimensions + facts) - the source of truth
--   mart    : business-friendly views that Power BI connects to
--   meta    : pipeline bookkeeping (runs, files, rejects, schema drift)
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS dw;
CREATE SCHEMA IF NOT EXISTS mart;
CREATE SCHEMA IF NOT EXISTS meta;
