-- +goose Up
ALTER TABLE app.ai_usage_events
  ADD COLUMN status text NOT NULL DEFAULT 'succeeded',
  ADD COLUMN usage_available boolean NOT NULL DEFAULT true,
  ADD COLUMN error_code text,
  ADD COLUMN error_status integer;

ALTER TABLE app.ai_usage_events
  DROP CONSTRAINT IF EXISTS app_ai_usage_events_status_check;

ALTER TABLE app.ai_usage_events
  ADD CONSTRAINT app_ai_usage_events_status_check
  CHECK (status IN ('succeeded', 'failed'));

ALTER TABLE app.ai_usage_events
  ALTER COLUMN model DROP NOT NULL;

-- +goose Down
UPDATE app.ai_usage_events
SET model = COALESCE(model, 'unknown')
WHERE model IS NULL;

ALTER TABLE app.ai_usage_events
  ALTER COLUMN model SET NOT NULL;

ALTER TABLE app.ai_usage_events
  DROP CONSTRAINT IF EXISTS app_ai_usage_events_status_check;

ALTER TABLE app.ai_usage_events
  DROP COLUMN error_status,
  DROP COLUMN error_code,
  DROP COLUMN usage_available,
  DROP COLUMN status;
