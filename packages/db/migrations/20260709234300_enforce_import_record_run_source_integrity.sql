-- +goose Up
-- +goose StatementBegin

ALTER TABLE app.import_runs
  ADD CONSTRAINT app_import_runs_id_source_id_key UNIQUE (id, source_id);

ALTER TABLE app.import_records
  DROP CONSTRAINT import_records_import_run_id_fkey,
  ADD CONSTRAINT app_import_records_run_source_fkey
    FOREIGN KEY (import_run_id, source_id)
    REFERENCES app.import_runs (id, source_id)
    ON DELETE CASCADE;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE app.import_records
  DROP CONSTRAINT IF EXISTS app_import_records_run_source_fkey,
  ADD CONSTRAINT import_records_import_run_id_fkey
    FOREIGN KEY (import_run_id)
    REFERENCES app.import_runs (id)
    ON DELETE CASCADE;

ALTER TABLE app.import_runs
  DROP CONSTRAINT IF EXISTS app_import_runs_id_source_id_key;

-- +goose StatementEnd
