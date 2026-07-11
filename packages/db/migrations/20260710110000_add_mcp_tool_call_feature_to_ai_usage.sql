-- +goose Up
ALTER TABLE app.ai_usage_events
  DROP CONSTRAINT IF EXISTS app_ai_usage_events_feature_check;

ALTER TABLE app.ai_usage_events
  ADD CONSTRAINT app_ai_usage_events_feature_check
  CHECK (
    feature IN (
      'chat_stream',
      'text_enhance',
      'task_extract',
      'voice_task_extract',
      'voice_cleanup',
      'embedding',
      'mcp_tool_call'
    )
  );

-- +goose Down
ALTER TABLE app.ai_usage_events
  DROP CONSTRAINT IF EXISTS app_ai_usage_events_feature_check;

ALTER TABLE app.ai_usage_events
  ADD CONSTRAINT app_ai_usage_events_feature_check
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
