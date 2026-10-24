-- +goose Up
-- +goose StatementBegin

-- Direct-to-R2 uploads create the row first (pending), then flip it to ready once the API has
-- verified the bytes. Existing rows default to ready so nothing already uploaded disappears.
-- IF NOT EXISTS / DROP CONSTRAINT IF EXISTS keep this idempotent since CI runs goose up twice.
ALTER TABLE app.files
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready';

ALTER TABLE app.files
  DROP CONSTRAINT IF EXISTS app_files_status_check;
ALTER TABLE app.files
  ADD CONSTRAINT app_files_status_check CHECK (status IN ('pending', 'ready'));

-- Lets a janitor find stale pending rows without scanning the whole table.
CREATE INDEX IF NOT EXISTS app_files_pending_createdat_idx
  ON app.files (createdat)
  WHERE status = 'pending';

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS app.app_files_pending_createdat_idx;
ALTER TABLE app.files DROP CONSTRAINT IF EXISTS app_files_status_check;
ALTER TABLE app.files DROP COLUMN IF EXISTS status;

-- +goose StatementEnd
