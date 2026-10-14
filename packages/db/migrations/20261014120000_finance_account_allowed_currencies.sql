-- +goose Up

ALTER TABLE app.finance_accounts
  ADD COLUMN IF NOT EXISTS allowed_currencies text[] NOT NULL DEFAULT '{}';

-- Retain the exact pre-migration values so Down only reverses corrections this
-- migration actually made, and does not overwrite a pre-existing correction.
CREATE TABLE IF NOT EXISTS app.finance_account_allowed_currencies_migration_state (
  account_id uuid PRIMARY KEY,
  original_currency_code text NOT NULL,
  original_allowed_currencies text[] NOT NULL,
  migrated_currency_code text NOT NULL,
  migrated_allowed_currencies text[] NOT NULL
);

INSERT INTO app.finance_account_allowed_currencies_migration_state (
  account_id,
  original_currency_code,
  original_allowed_currencies,
  migrated_currency_code,
  migrated_allowed_currencies
)
SELECT id, currency_code, allowed_currencies, 'GBP', allowed_currencies
FROM app.finance_accounts
WHERE id = 'f1000003-0000-4000-8000-000000000031'
  AND name = 'Starling Bank'
  AND currency_code = 'USD'
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO app.finance_account_allowed_currencies_migration_state (
  account_id,
  original_currency_code,
  original_allowed_currencies,
  migrated_currency_code,
  migrated_allowed_currencies
)
SELECT
  id,
  currency_code,
  allowed_currencies,
  currency_code,
  ARRAY(
    SELECT currency
    FROM (
      SELECT DISTINCT currency
      FROM unnest(allowed_currencies || ARRAY['USD', 'GBP']::text[]) AS currency
    ) AS currencies
    ORDER BY currency = currency_code DESC, currency
  )
FROM app.finance_accounts
WHERE id = 'f1000003-0000-4000-8000-000000000003'
  AND name = 'American Express Platinum'
  AND currency_code = 'USD'
ON CONFLICT (account_id) DO NOTHING;

-- Starling is a GBP account. This repairs the seed-era account metadata only;
-- existing transaction rows and amounts are intentionally untouched.
UPDATE app.finance_accounts
SET currency_code = 'GBP', updated_at = now()
WHERE id = 'f1000003-0000-4000-8000-000000000031'
  AND name = 'Starling Bank'
  AND currency_code = 'USD';

-- The account's primary currency remains USD; GBP is an explicitly permitted
-- additional currency for its existing side-bucket transactions.
UPDATE app.finance_accounts
SET allowed_currencies = ARRAY(
  SELECT currency
  FROM (
    SELECT DISTINCT currency
    FROM unnest(allowed_currencies || ARRAY['USD', 'GBP']::text[]) AS currency
  ) AS currencies
  ORDER BY currency = currency_code DESC, currency
), updated_at = now()
WHERE id = 'f1000003-0000-4000-8000-000000000003'
  AND name = 'American Express Platinum'
  AND currency_code = 'USD';

-- +goose Down

DO $$
BEGIN
  IF to_regclass('app.finance_account_allowed_currencies_migration_state') IS NOT NULL THEN
    UPDATE app.finance_accounts AS account
    SET currency_code = state.original_currency_code,
        allowed_currencies = state.original_allowed_currencies,
        updated_at = now()
    FROM app.finance_account_allowed_currencies_migration_state AS state
    WHERE account.id = state.account_id
      AND account.currency_code = state.migrated_currency_code
      AND account.allowed_currencies = state.migrated_allowed_currencies;

    DROP TABLE app.finance_account_allowed_currencies_migration_state;
  END IF;
END $$;

ALTER TABLE app.finance_accounts
  DROP COLUMN IF EXISTS allowed_currencies;
