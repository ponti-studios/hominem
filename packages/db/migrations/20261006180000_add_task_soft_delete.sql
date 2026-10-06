-- +goose Up
-- +goose StatementBegin

-- Offline clients pull tasks by `updatedat` cursor, so a delete must stay
-- visible as a tombstone until every device has seen it.
ALTER TABLE app.tasks
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS app_tasks_owner_updated_idx
  ON app.tasks (owner_userId, updatedat);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS app.app_tasks_owner_updated_idx;

ALTER TABLE app.tasks
  DROP COLUMN IF EXISTS deleted_at;

-- +goose StatementEnd
