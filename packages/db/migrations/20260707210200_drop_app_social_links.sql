-- DESTRUCTIVE: drops the portfolio-scoped app.social_links table.
-- Superseded by app.user_social_links (user-scoped), created and backfilled in
-- 20260707210000_create_app_user_social_links.sql and 20260707210100_backfill_app_user_social_links.sql.
-- Data cannot be recovered after this migration applies.
-- Verified safe: no application code reads/writes app.social_links as of 2026-07-07;
-- all reads/writes moved to CareerRepository.getUserSocialLinks/saveUserSocialLinks.
--
-- DEPLOYMENT NOTE: do not run this against production until the application code that
-- reads/writes app.user_social_links (this commit) has been deployed and verified there.
-- Migrations must run before the app code that depends on them, and this is the reverse
-- case: dropping app.social_links depends on app code already having stopped using it.

-- +goose Up
-- +goose StatementBegin
DROP TABLE IF EXISTS app.social_links;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE TABLE app.social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES app.portfolios(id) ON DELETE CASCADE,
  github text,
  linkedin text,
  twitter text,
  website text,
  createdat timestamptz NOT NULL DEFAULT now(),
  updatedat timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.social_links
  ADD CONSTRAINT app_social_links_portfolio_id_key UNIQUE (portfolio_id);

CREATE INDEX app_social_links_portfolio_id_idx ON app.social_links (portfolio_id);

ALTER TABLE app.social_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_social_links_select_policy ON app.social_links
  FOR SELECT
  USING (auth.can_read_portfolio(portfolio_id));

CREATE POLICY app_social_links_owner_write_policy ON app.social_links
  FOR ALL
  USING (auth.is_portfolio_owner(portfolio_id))
  WITH CHECK (auth.is_portfolio_owner(portfolio_id));
-- +goose StatementEnd
