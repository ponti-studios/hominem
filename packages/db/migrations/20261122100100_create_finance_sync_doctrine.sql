-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS app.finance_sync_doctrine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  contents jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE app.finance_sync_doctrine ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.finance_sync_doctrine FORCE ROW LEVEL SECURITY;
CREATE POLICY finance_sync_doctrine_owner ON app.finance_sync_doctrine
  FOR ALL USING (auth.is_service_role() OR user_id = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR user_id = auth.current_user_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.finance_sync_doctrine;
-- +goose StatementEnd
