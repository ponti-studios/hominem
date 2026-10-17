-- +goose Up
CREATE TABLE app.chat_generation_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid REFERENCES app.chat_generation_runs(id) ON DELETE SET NULL,
  owner_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  effect_type text NOT NULL,
  effect_key text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_chat_generation_effects_type_check
    CHECK (effect_type IN ('chat_embedding', 'speech_run_persist')),
  CONSTRAINT app_chat_generation_effects_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT app_chat_generation_effects_generation_type_unique
    UNIQUE (generation_id, effect_type, effect_key)
);

CREATE INDEX app_chat_generation_effects_ready_idx
  ON app.chat_generation_effects (next_attempt_at ASC, created_at ASC)
  WHERE status IN ('pending', 'processing');

CREATE TRIGGER app_chat_generation_effects_set_updated_at
  BEFORE UPDATE ON app.chat_generation_effects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_snake();

ALTER TABLE app.chat_generation_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.chat_generation_effects FORCE ROW LEVEL SECURITY;

CREATE POLICY app_chat_generation_effects_owner_policy ON app.chat_generation_effects
  FOR ALL
  USING (auth.is_service_role() OR owner_user_id = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_user_id = auth.current_user_id());

-- +goose Down
DROP TRIGGER IF EXISTS app_chat_generation_effects_set_updated_at ON app.chat_generation_effects;
DROP POLICY IF EXISTS app_chat_generation_effects_owner_policy ON app.chat_generation_effects;
ALTER TABLE IF EXISTS app.chat_generation_effects NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app.chat_generation_effects DISABLE ROW LEVEL SECURITY;
DROP INDEX IF EXISTS app.app_chat_generation_effects_ready_idx;
DROP TABLE IF EXISTS app.chat_generation_effects;
