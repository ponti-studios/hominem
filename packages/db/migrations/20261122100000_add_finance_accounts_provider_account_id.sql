-- +goose Up
-- +goose StatementBegin
ALTER TABLE app.finance_accounts ADD COLUMN provider_account_id text;
CREATE UNIQUE INDEX IF NOT EXISTS finance_accounts_provider_identity_idx
  ON app.finance_accounts (user_id, provider, provider_account_id)
  WHERE provider_account_id IS NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS app.finance_accounts_provider_identity_idx;
ALTER TABLE app.finance_accounts DROP COLUMN IF EXISTS provider_account_id;
-- +goose StatementEnd
