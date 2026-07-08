-- +goose Up
-- +goose StatementBegin
CREATE TABLE app.user_social_links (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  github text,
  linkedin text,
  twitter text,
  website text,
  createdat timestamptz NOT NULL DEFAULT now(),
  updatedat timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.user_social_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_user_social_links_select_policy ON app.user_social_links
  FOR SELECT
  USING (user_id = auth.current_user_id() OR auth.is_service_role());

CREATE POLICY app_user_social_links_insert_policy ON app.user_social_links
  FOR INSERT
  WITH CHECK (user_id = auth.current_user_id() OR auth.is_service_role());

CREATE POLICY app_user_social_links_update_policy ON app.user_social_links
  FOR UPDATE
  USING (user_id = auth.current_user_id() OR auth.is_service_role())
  WITH CHECK (user_id = auth.current_user_id() OR auth.is_service_role());

CREATE POLICY app_user_social_links_delete_policy ON app.user_social_links
  FOR DELETE
  USING (user_id = auth.current_user_id() OR auth.is_service_role());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.user_social_links;
-- +goose StatementEnd
