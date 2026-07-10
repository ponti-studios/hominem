-- Up: AI usage telemetry, added during reconciliation. Chapters 12-15 previously had no SQL pairing;
-- this table is the one piece of real schema this policy area now owns.
CREATE TABLE app.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (btrim(provider) <> ''),
  feature text NOT NULL CHECK (feature IN ('chat_stream','text_enhance','task_extract','voice_task_extract','voice_cleanup','embedding')),
  operation text NOT NULL CHECK (operation IN ('chat_completion','structured_output','embedding')), model text NOT NULL, request_id text,
  input_tokens integer NOT NULL CHECK (input_tokens >= 0), output_tokens integer NOT NULL CHECK (output_tokens >= 0),
  total_tokens integer NOT NULL CHECK (total_tokens >= 0 AND total_tokens = input_tokens + output_tokens),
  cached_input_tokens integer CHECK (cached_input_tokens IS NULL OR cached_input_tokens >= 0),
  reasoning_tokens integer CHECK (reasoning_tokens IS NULL OR reasoning_tokens >= 0),
  cost_usd numeric(12,8) CHECK (cost_usd IS NULL OR cost_usd >= 0), metadata jsonb, createdAt timestamptz NOT NULL DEFAULT now()
);
