-- +goose Up
-- recordAIUsageEvent accepts feature values that must match the DB check;
-- career_resume_analyze was added to the code enum (packages/db/src/services/ai)
-- for the resume-analysis worker job. Bring the constraint up to the code's
-- feature list (see 20260911150000_add_note_generate_ai_usage_feature.sql for
-- the same class of fix).
ALTER TABLE app.ai_usage_events
  DROP CONSTRAINT IF EXISTS app_ai_usage_events_feature_check;

ALTER TABLE app.ai_usage_events
  ADD CONSTRAINT app_ai_usage_events_feature_check
  CHECK (
    feature IN (
      'chat_stream',
      'text_enhance',
      'note_generate',
      'task_extract',
      'voice_task_extract',
      'time_block_extract',
      'voice_cleanup',
      'chat_speech',
      'embedding',
      'mcp_tool_call',
      'career_resume_analyze',
      'career_resume_convert',
      'career_resume_customize',
      'career_job_scrape',
      'career_skills_derive',
      'file_image_analyze',
      'file_document_summarize'
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
      'note_generate',
      'task_extract',
      'voice_task_extract',
      'time_block_extract',
      'voice_cleanup',
      'chat_speech',
      'embedding',
      'mcp_tool_call',
      'career_resume_convert',
      'career_resume_customize',
      'career_job_scrape',
      'career_skills_derive',
      'file_image_analyze',
      'file_document_summarize'
    )
  );
