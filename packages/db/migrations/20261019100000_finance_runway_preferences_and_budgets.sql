-- +goose Up
ALTER TABLE app.finance_categories
  ADD CONSTRAINT finance_categories_id_user_id_key UNIQUE (id, user_id);

CREATE TABLE app.finance_runway_preferences (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.finance_monthly_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  category_id uuid NOT NULL,
  currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  monthly_amount numeric(14, 2) NOT NULL CHECK (monthly_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_monthly_budgets_category_owner_fk
    FOREIGN KEY (category_id, user_id)
    REFERENCES app.finance_categories(id, user_id) ON DELETE CASCADE,
  CONSTRAINT finance_monthly_budgets_user_category_currency_key
    UNIQUE (user_id, category_id, currency_code)
);

CREATE INDEX finance_monthly_budgets_user_currency_idx
  ON app.finance_monthly_budgets(user_id, currency_code);

ALTER TABLE app.finance_runway_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.finance_runway_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY finance_runway_preferences_owner_policy ON app.finance_runway_preferences
  FOR ALL USING (auth.is_service_role() OR user_id = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR user_id = auth.current_user_id());

ALTER TABLE app.finance_monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.finance_monthly_budgets FORCE ROW LEVEL SECURITY;
CREATE POLICY finance_monthly_budgets_owner_policy ON app.finance_monthly_budgets
  FOR ALL USING (auth.is_service_role() OR user_id = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR user_id = auth.current_user_id());

-- +goose Down
DROP TABLE app.finance_monthly_budgets;
DROP TABLE app.finance_runway_preferences;
ALTER TABLE app.finance_categories DROP CONSTRAINT finance_categories_id_user_id_key;
