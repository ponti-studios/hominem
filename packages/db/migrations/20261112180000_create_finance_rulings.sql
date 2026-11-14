-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS app.finance_ruling_preparations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS app.finance_ruling_verdicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  preparation_id uuid NOT NULL,
  cluster_id text NOT NULL,
  merchant text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('file', 'change', 'kill')),
  category text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  rows jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_ruling_verdict_preparation_owner_fk
    FOREIGN KEY (preparation_id, user_id)
    REFERENCES app.finance_ruling_preparations(id, user_id) ON DELETE CASCADE,
  UNIQUE (id, user_id),
  UNIQUE (user_id, preparation_id, cluster_id)
);

CREATE TABLE IF NOT EXISTS app.finance_ruling_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  verdict_id uuid NOT NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_ruling_event_verdict_owner_fk
    FOREIGN KEY (verdict_id, user_id)
    REFERENCES app.finance_ruling_verdicts(id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS finance_ruling_preparations_user_created_idx
  ON app.finance_ruling_preparations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS finance_ruling_verdicts_user_created_idx
  ON app.finance_ruling_verdicts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS finance_ruling_events_verdict_idx
  ON app.finance_ruling_events (user_id, verdict_id, id);

ALTER TABLE app.finance_ruling_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.finance_ruling_preparations FORCE ROW LEVEL SECURITY;
CREATE POLICY finance_ruling_preparations_owner ON app.finance_ruling_preparations
  FOR ALL USING (auth.is_service_role() OR user_id = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR user_id = auth.current_user_id());
ALTER TABLE app.finance_ruling_verdicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.finance_ruling_verdicts FORCE ROW LEVEL SECURITY;
CREATE POLICY finance_ruling_verdicts_owner ON app.finance_ruling_verdicts
  FOR ALL USING (auth.is_service_role() OR user_id = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR user_id = auth.current_user_id());
ALTER TABLE app.finance_ruling_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.finance_ruling_events FORCE ROW LEVEL SECURITY;
CREATE POLICY finance_ruling_events_owner ON app.finance_ruling_events
  FOR ALL USING (auth.is_service_role() OR user_id = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR user_id = auth.current_user_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.finance_ruling_events;
DROP TABLE IF EXISTS app.finance_ruling_verdicts;
DROP TABLE IF EXISTS app.finance_ruling_preparations;
-- +goose StatementEnd
