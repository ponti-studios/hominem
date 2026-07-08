-- +goose Up
-- Normalize the remaining CamelCase columns in app.finance_* tables to snake_case.

-- 1. Drop triggers that reference the old column names
DROP TRIGGER IF EXISTS app_finance_accounts_set_updated_at ON app.finance_accounts;
DROP TRIGGER IF EXISTS app_finance_transactions_set_updated_at ON app.finance_transactions;
DROP TRIGGER IF EXISTS app_plaid_items_set_updated_at ON app.plaid_items;
DROP TRIGGER IF EXISTS app_finance_institutions_set_updated_at ON app.finance_institutions;

-- 2. Drop RLS policies that reference old column names
DROP POLICY IF EXISTS app_finance_accounts_owner_policy ON app.finance_accounts;
DROP POLICY IF EXISTS app_finance_transactions_owner_policy ON app.finance_transactions;
DROP POLICY IF EXISTS app_plaid_items_owner_policy ON app.plaid_items;

-- 3. Drop constraints that reference old column names
ALTER TABLE app.finance_accounts
  DROP CONSTRAINT IF EXISTS app_finance_accounts_provider_account_id_not_blank;
ALTER TABLE app.plaid_items
  DROP CONSTRAINT IF EXISTS app_plaid_items_access_token_not_blank;

-- 4. Drop indexes whose WHERE clause references old column names
DROP INDEX IF EXISTS app.app_finance_accounts_owner_provider_account_key;

-- 5. Rename columns

-- finance_accounts
ALTER TABLE app.finance_accounts RENAME COLUMN owner_userid TO user_id;
ALTER TABLE app.finance_accounts RENAME COLUMN accountid TO plaid_account_id;
ALTER TABLE app.finance_accounts RENAME COLUMN createdat TO created_at;
ALTER TABLE app.finance_accounts RENAME COLUMN updatedat TO updated_at;

-- finance_transactions
ALTER TABLE app.finance_transactions RENAME COLUMN owner_userid TO user_id;
ALTER TABLE app.finance_transactions RENAME COLUMN createdat TO created_at;
ALTER TABLE app.finance_transactions RENAME COLUMN updatedat TO updated_at;

-- plaid_items
ALTER TABLE app.plaid_items RENAME COLUMN owner_userid TO user_id;
ALTER TABLE app.plaid_items RENAME COLUMN accesstoken TO access_token;
ALTER TABLE app.plaid_items RENAME COLUMN createdat TO created_at;
ALTER TABLE app.plaid_items RENAME COLUMN updatedat TO updated_at;

-- finance_institutions
ALTER TABLE app.finance_institutions RENAME COLUMN createdat TO created_at;
ALTER TABLE app.finance_institutions RENAME COLUMN updatedat TO updated_at;

-- 6. Recreate constraints with new column names
ALTER TABLE app.finance_accounts
  ADD CONSTRAINT app_finance_accounts_provider_account_id_not_blank CHECK (
    plaid_account_id IS NULL OR length(btrim(plaid_account_id)) > 0
  );
ALTER TABLE app.plaid_items
  ADD CONSTRAINT app_plaid_items_access_token_not_blank CHECK (
    access_token IS NULL OR length(btrim(access_token)) > 0
  );

-- 7. Recreate indexes with new column names
CREATE UNIQUE INDEX app_finance_accounts_owner_provider_account_key
  ON app.finance_accounts (user_id, provider, plaid_account_id)
  WHERE provider IS NOT NULL AND plaid_account_id IS NOT NULL;

-- 8. Create a trigger function that uses updated_at (snake_case)
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION public.set_updated_at_snake()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
-- +goose StatementEnd

-- 9. Recreate triggers on finance tables
CREATE TRIGGER app_finance_accounts_set_updated_at
  BEFORE UPDATE ON app.finance_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_snake();

CREATE TRIGGER app_finance_transactions_set_updated_at
  BEFORE UPDATE ON app.finance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_snake();

CREATE TRIGGER app_plaid_items_set_updated_at
  BEFORE UPDATE ON app.plaid_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_snake();

CREATE TRIGGER app_finance_institutions_set_updated_at
  BEFORE UPDATE ON app.finance_institutions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_snake();

-- 10. Recreate RLS policies with new column name
CREATE POLICY app_finance_accounts_owner_policy ON app.finance_accounts
  FOR ALL
  USING (
    auth.is_service_role()
    OR user_id = auth.current_user_id()
  )
  WITH CHECK (
    auth.is_service_role()
    OR user_id = auth.current_user_id()
  );

CREATE POLICY app_finance_transactions_owner_policy ON app.finance_transactions
  FOR ALL
  USING (
    auth.is_service_role()
    OR user_id = auth.current_user_id()
  )
  WITH CHECK (
    auth.is_service_role()
    OR user_id = auth.current_user_id()
  );

CREATE POLICY app_plaid_items_owner_policy ON app.plaid_items
  FOR ALL
  USING (
    auth.is_service_role()
    OR user_id = auth.current_user_id()
  )
  WITH CHECK (
    auth.is_service_role()
    OR user_id = auth.current_user_id()
  );

-- +goose Down
-- 1. Drop new RLS policies
DROP POLICY IF EXISTS app_finance_accounts_owner_policy ON app.finance_accounts;
DROP POLICY IF EXISTS app_finance_transactions_owner_policy ON app.finance_transactions;
DROP POLICY IF EXISTS app_plaid_items_owner_policy ON app.plaid_items;

-- 2. Drop new triggers
DROP TRIGGER IF EXISTS app_finance_accounts_set_updated_at ON app.finance_accounts;
DROP TRIGGER IF EXISTS app_finance_transactions_set_updated_at ON app.finance_transactions;
DROP TRIGGER IF EXISTS app_plaid_items_set_updated_at ON app.plaid_items;
DROP TRIGGER IF EXISTS app_finance_institutions_set_updated_at ON app.finance_institutions;

-- 3. Drop new trigger function
DROP FUNCTION IF EXISTS public.set_updated_at_snake();

-- 4. Drop new index
DROP INDEX IF EXISTS app.app_finance_accounts_owner_provider_account_key;

-- 5. Drop new constraints
ALTER TABLE app.finance_accounts
  DROP CONSTRAINT IF EXISTS app_finance_accounts_provider_account_id_not_blank;
ALTER TABLE app.plaid_items
  DROP CONSTRAINT IF EXISTS app_plaid_items_access_token_not_blank;

-- 6. Rename columns back
ALTER TABLE app.finance_institutions RENAME COLUMN updated_at TO updatedat;
ALTER TABLE app.finance_institutions RENAME COLUMN created_at TO createdat;

ALTER TABLE app.plaid_items RENAME COLUMN updated_at TO updatedat;
ALTER TABLE app.plaid_items RENAME COLUMN created_at TO createdat;
ALTER TABLE app.plaid_items RENAME COLUMN access_token TO accesstoken;
ALTER TABLE app.plaid_items RENAME COLUMN user_id TO owner_userid;

ALTER TABLE app.finance_transactions RENAME COLUMN updated_at TO updatedat;
ALTER TABLE app.finance_transactions RENAME COLUMN created_at TO createdat;
ALTER TABLE app.finance_transactions RENAME COLUMN user_id TO owner_userid;

ALTER TABLE app.finance_accounts RENAME COLUMN updated_at TO updatedat;
ALTER TABLE app.finance_accounts RENAME COLUMN created_at TO createdat;
ALTER TABLE app.finance_accounts RENAME COLUMN plaid_account_id TO accountid;
ALTER TABLE app.finance_accounts RENAME COLUMN user_id TO owner_userid;

-- 7. Add old constraints
ALTER TABLE app.finance_accounts
  ADD CONSTRAINT app_finance_accounts_provider_account_id_not_blank CHECK (
    accountid IS NULL OR length(btrim(accountid)) > 0
  );
ALTER TABLE app.plaid_items
  ADD CONSTRAINT app_plaid_items_access_token_not_blank CHECK (
    accesstoken IS NULL OR length(btrim(accesstoken)) > 0
  );

-- 8. Restore old index
CREATE UNIQUE INDEX app_finance_accounts_owner_provider_account_key
  ON app.finance_accounts (owner_userid, provider, accountid)
  WHERE provider IS NOT NULL AND accountid IS NOT NULL;

-- 9. Restore old triggers
CREATE TRIGGER app_finance_accounts_set_updated_at
  BEFORE UPDATE ON app.finance_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER app_finance_transactions_set_updated_at
  BEFORE UPDATE ON app.finance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER app_plaid_items_set_updated_at
  BEFORE UPDATE ON app.plaid_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER app_finance_institutions_set_updated_at
  BEFORE UPDATE ON app.finance_institutions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 10. Restore old RLS policies
CREATE POLICY app_finance_accounts_owner_policy ON app.finance_accounts
  FOR ALL
  USING (
    auth.is_service_role()
    OR owner_userid = auth.current_user_id()
  )
  WITH CHECK (
    auth.is_service_role()
    OR owner_userid = auth.current_user_id()
  );

CREATE POLICY app_finance_transactions_owner_policy ON app.finance_transactions
  FOR ALL
  USING (
    auth.is_service_role()
    OR owner_userid = auth.current_user_id()
  )
  WITH CHECK (
    auth.is_service_role()
    OR owner_userid = auth.current_user_id()
  );

CREATE POLICY app_plaid_items_owner_policy ON app.plaid_items
  FOR ALL
  USING (
    auth.is_service_role()
    OR owner_userid = auth.current_user_id()
  )
  WITH CHECK (
    auth.is_service_role()
    OR owner_userid = auth.current_user_id()
  );
