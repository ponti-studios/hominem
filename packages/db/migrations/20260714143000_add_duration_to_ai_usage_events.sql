-- +goose Up
ALTER TABLE app.ai_usage_events
  ADD COLUMN duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0);

-- +goose Down
ALTER TABLE app.ai_usage_events
  DROP COLUMN IF EXISTS duration_ms;
