-- +goose Up

ALTER TABLE app.finance_accounts
  ADD COLUMN IF NOT EXISTS allowed_currencies text[] NOT NULL DEFAULT '{}';

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
SET allowed_currencies = ARRAY['USD', 'GBP']::text[], updated_at = now()
WHERE id = 'f1000003-0000-4000-8000-000000000003'
  AND name = 'American Express Platinum'
  AND currency_code = 'USD';

-- +goose Down

UPDATE app.finance_accounts
SET currency_code = 'USD', updated_at = now()
WHERE id = 'f1000003-0000-4000-8000-000000000031'
  AND name = 'Starling Bank'
  AND currency_code = 'GBP';

UPDATE app.finance_accounts
SET allowed_currencies = '{}', updated_at = now()
WHERE id = 'f1000003-0000-4000-8000-000000000003'
  AND name = 'American Express Platinum'
  AND currency_code = 'USD';

ALTER TABLE app.finance_accounts
  DROP COLUMN IF EXISTS allowed_currencies;
