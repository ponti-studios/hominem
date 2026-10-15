-- +goose Up
ALTER TABLE app.finance_transactions
  ADD COLUMN order_number text;

DROP INDEX IF EXISTS app.app_finance_transactions_owner_source_external_key;
CREATE UNIQUE INDEX app_finance_transactions_owner_account_source_external_key
  ON app.finance_transactions (user_id, account_id, source, external_id)
  WHERE source IS NOT NULL AND external_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS app.app_finance_transactions_owner_account_source_external_key;
CREATE UNIQUE INDEX app_finance_transactions_owner_source_external_key
  ON app.finance_transactions (user_id, source, external_id)
  WHERE source IS NOT NULL AND external_id IS NOT NULL;
ALTER TABLE app.finance_transactions DROP COLUMN order_number;
