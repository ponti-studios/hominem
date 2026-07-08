-- +goose Up
-- +goose StatementBegin

-- 1. Deduplicate portfolios: keep only the most recently updated per user
DELETE FROM app.portfolios
WHERE id NOT IN (
  SELECT DISTINCT ON (owner_userid) id
  FROM app.portfolios
  ORDER BY owner_userid, updatedat DESC
);

-- 2. Re-add unique constraint (one portfolio per user)
ALTER TABLE app.portfolios
  ADD CONSTRAINT app_portfolios_owner_userId_key UNIQUE (owner_userid);

-- 3. Drop the theme column
ALTER TABLE app.portfolios DROP COLUMN IF EXISTS theme;

-- 4. Drop user_portfolio_preferences (no longer needed)
DROP TABLE IF EXISTS app.user_portfolio_preferences;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- 1. Re-create user_portfolio_preferences
CREATE TABLE app.user_portfolio_preferences (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  current_portfolio_id uuid REFERENCES app.portfolios(id) ON DELETE SET NULL,
  createdat timestamptz NOT NULL DEFAULT now(),
  updatedat timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.user_portfolio_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_user_portfolio_preferences_select_policy ON app.user_portfolio_preferences
  FOR SELECT
  USING (user_id = auth.current_user_id() OR auth.is_service_role());

CREATE POLICY app_user_portfolio_preferences_insert_policy ON app.user_portfolio_preferences
  FOR INSERT
  WITH CHECK (user_id = auth.current_user_id() OR auth.is_service_role());

CREATE POLICY app_user_portfolio_preferences_update_policy ON app.user_portfolio_preferences
  FOR UPDATE
  USING (user_id = auth.current_user_id() OR auth.is_service_role())
  WITH CHECK (user_id = auth.current_user_id() OR auth.is_service_role());

CREATE POLICY app_user_portfolio_preferences_delete_policy ON app.user_portfolio_preferences
  FOR DELETE
  USING (user_id = auth.current_user_id() OR auth.is_service_role());

-- 2. Re-add theme column
ALTER TABLE app.portfolios ADD COLUMN theme jsonb;

-- 3. Drop unique constraint
ALTER TABLE app.portfolios
  DROP CONSTRAINT IF EXISTS app_portfolios_owner_userId_key;

-- +goose StatementEnd
