-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS app.finance_ruling_rulebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  source text NOT NULL CHECK (source IN ('reference', 'live')),
  contents jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS finance_ruling_rulebooks_user_created_idx
  ON app.finance_ruling_rulebooks (user_id, created_at DESC);
ALTER TABLE app.finance_ruling_rulebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.finance_ruling_rulebooks FORCE ROW LEVEL SECURITY;
CREATE POLICY finance_ruling_rulebooks_owner ON app.finance_ruling_rulebooks
  FOR ALL USING (auth.is_service_role() OR user_id = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR user_id = auth.current_user_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.finance_ruling_rulebooks;
-- +goose StatementEnd
