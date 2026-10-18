-- +goose NO TRANSACTION
-- +goose Up
CREATE INDEX CONCURRENTLY IF NOT EXISTS finance_transactions_description_trgm_idx
  ON app.finance_transactions USING gin (lower(description) gin_trgm_ops)
  WHERE description IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS finance_transactions_merchant_trgm_idx
  ON app.finance_transactions USING gin (lower(merchant_name) gin_trgm_ops)
  WHERE merchant_name IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS finance_accounts_name_trgm_idx
  ON app.finance_accounts USING gin (lower(name) gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS finance_categories_name_trgm_idx
  ON app.finance_categories USING gin (lower(name) gin_trgm_ops);

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS app.finance_categories_name_trgm_idx;
DROP INDEX CONCURRENTLY IF EXISTS app.finance_accounts_name_trgm_idx;
DROP INDEX CONCURRENTLY IF EXISTS app.finance_transactions_merchant_trgm_idx;
DROP INDEX CONCURRENTLY IF EXISTS app.finance_transactions_description_trgm_idx;
