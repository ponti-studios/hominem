-- +goose Up
-- +goose StatementBegin
-- One budget per (user, category), each with its own cadence. The period is derived from the
-- cadence and spent totals are computed from transactions at read time, so a row only stores
-- the limit and its cadence. The budget has no currency of its own: it is denominated in the
-- user profile's primary currency (app.user_profiles.primary_currency), resolved at read time.
CREATE TABLE app.finance_budgets (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  category_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  -- Fixed set for V1. A cadence outside it is rejected by the database, not only by the tool
  -- schema, so custom periods cannot leak in through a direct write.
  cadence text NOT NULL CHECK (cadence IN ('weekly', 'monthly', 'quarterly', 'annual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- A category has one budget with one cadence; changing cadence or amount updates that row.
  CONSTRAINT finance_budgets_user_category_key UNIQUE (user_id, category_id),
  CONSTRAINT finance_budgets_category_owner_fk
    FOREIGN KEY (category_id, user_id)
    REFERENCES app.finance_categories(id, user_id) ON DELETE CASCADE
);

CREATE INDEX idx_finance_budgets_user
  ON app.finance_budgets(user_id);

CREATE TRIGGER set_updated_at_finance_budgets
  BEFORE UPDATE ON app.finance_budgets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_snake();

ALTER TABLE app.finance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.finance_budgets FORCE ROW LEVEL SECURITY;
CREATE POLICY finance_budgets_owner_policy ON app.finance_budgets
  FOR ALL
  USING (auth.is_service_role() OR user_id = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR user_id = auth.current_user_id());

-- The user profile holds the primary currency budgets are denominated in. It is added here
-- because no general profile table exists yet and budgets must not store a currency of their
-- own. The value is set by an explicit user action, never as a side effect of creating a budget.
CREATE TABLE app.user_profiles (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  primary_currency text NOT NULL CHECK (primary_currency ~ '^[A-Z]{3}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_user_profiles
  BEFORE UPDATE ON app.user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_snake();

ALTER TABLE app.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY user_profiles_owner_policy ON app.user_profiles
  FOR ALL
  USING (auth.is_service_role() OR user_id = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR user_id = auth.current_user_id());

-- The amount a foreign-currency transaction actually charged to the account, in the currency
-- it was charged in. Budgets count a foreign transaction only when that settled currency is
-- the user's primary currency; no exchange rate is ever looked up, stored or applied. Both
-- columns are set together or not at all.
ALTER TABLE app.finance_transactions
  ADD COLUMN settled_amount numeric(14, 2),
  ADD COLUMN settled_currency_code text;

ALTER TABLE app.finance_transactions
  ADD CONSTRAINT finance_transactions_settled_pair_check
    CHECK ((settled_amount IS NULL) = (settled_currency_code IS NULL)),
  ADD CONSTRAINT finance_transactions_settled_amount_check
    CHECK (settled_amount IS NULL OR settled_amount >= 0),
  ADD CONSTRAINT finance_transactions_settled_currency_check
    CHECK (settled_currency_code IS NULL OR settled_currency_code ~ '^[A-Z]{3}$');

-- Budget status reads one category's transactions across a date range.
CREATE INDEX idx_finance_transactions_user_category_posted
  ON app.finance_transactions (user_id, category_id, posted_on)
  WHERE category_id IS NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS app.idx_finance_transactions_user_category_posted;
ALTER TABLE app.finance_transactions
  DROP CONSTRAINT IF EXISTS finance_transactions_settled_currency_check,
  DROP CONSTRAINT IF EXISTS finance_transactions_settled_amount_check,
  DROP CONSTRAINT IF EXISTS finance_transactions_settled_pair_check,
  DROP COLUMN IF EXISTS settled_currency_code,
  DROP COLUMN IF EXISTS settled_amount;
DROP TABLE IF EXISTS app.user_profiles;
DROP TABLE IF EXISTS app.finance_budgets;
-- +goose StatementEnd
