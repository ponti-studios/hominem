-- +goose Up
-- +goose StatementBegin

-- Agents read job boards themselves and push postings through the career MCP tools, so the
-- server-side import queue table is gone. IF EXISTS keeps this idempotent (CI runs goose up twice).
DROP TABLE IF EXISTS app.career_import_jobs;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Intentionally empty: the import pipeline is removed for good and its rows were disposable drafts.
SELECT 1;

-- +goose StatementEnd
