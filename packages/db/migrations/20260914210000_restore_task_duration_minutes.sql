-- +goose Up
-- +goose StatementBegin

-- Restore the scheduling field required by the task API. A historical local
-- migration ledger entry exists without its matching migration file, so this
-- must be safe both for intact databases and for the drifted development DB.
ALTER TABLE app.tasks
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

ALTER TABLE app.tasks
  DROP CONSTRAINT IF EXISTS app_tasks_duration_positive_check;

ALTER TABLE app.tasks
  ADD CONSTRAINT app_tasks_duration_positive_check CHECK (
    duration_minutes IS NULL OR duration_minutes > 0
  );

CREATE INDEX IF NOT EXISTS app_tasks_owner_scheduling_window_idx
  ON app.tasks (owner_userId, scheduling_window_start_at, scheduling_window_end_at)
  WHERE scheduled_start_at IS NULL AND duration_minutes IS NOT NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS app.app_tasks_owner_scheduling_window_idx;

ALTER TABLE app.tasks
  DROP CONSTRAINT IF EXISTS app_tasks_duration_positive_check,
  DROP COLUMN IF EXISTS duration_minutes;

-- +goose StatementEnd
