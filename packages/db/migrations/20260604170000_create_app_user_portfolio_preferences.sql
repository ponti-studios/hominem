-- +goose Up
-- +goose StatementBegin
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
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.user_portfolio_preferences;
-- +goose StatementEnd
