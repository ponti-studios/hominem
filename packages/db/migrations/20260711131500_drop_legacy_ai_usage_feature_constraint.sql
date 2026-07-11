-- +goose Up
ALTER TABLE app.ai_usage_events
  DROP CONSTRAINT IF EXISTS ai_usage_events_feature_check;

-- +goose Down
ALTER TABLE app.ai_usage_events
  ADD CONSTRAINT ai_usage_events_feature_check
  CHECK (
    feature IN (
      'chat_stream',
      'text_enhance',
      'task_extract',
      'voice_task_extract',
      'voice_cleanup',
      'embedding'
    )
  );
