-- +goose Up
-- +goose StatementBegin
-- Task duration storage is removed: nothing queries the scheduling-window
-- columns (write/read plumbing only), so the partial index predicated on
-- duration_minutes is dropped entirely rather than redefined.
DROP INDEX IF EXISTS app.app_tasks_owner_scheduling_window_idx;
ALTER TABLE app.tasks
  DROP CONSTRAINT IF EXISTS app_tasks_duration_positive_check,
  DROP COLUMN IF EXISTS duration_minutes;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE app.tasks
  ADD COLUMN duration_minutes integer,
  ADD CONSTRAINT app_tasks_duration_positive_check CHECK (
    duration_minutes IS NULL OR duration_minutes > 0
  );
CREATE INDEX app_tasks_owner_scheduling_window_idx
  ON app.tasks (owner_userId, scheduling_window_start_at, scheduling_window_end_at)
  WHERE scheduled_start_at IS NULL AND duration_minutes IS NOT NULL;
-- +goose StatementEnd
