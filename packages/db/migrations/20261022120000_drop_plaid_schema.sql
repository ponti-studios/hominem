-- +goose Up
-- +goose StatementBegin

-- Plaid is gone: no code reads or writes these (the app stopped touching them
-- in the plaid-removal PR). Dropping the table also wipes any stored access
-- tokens. DROP ... IF EXISTS keeps this idempotent since CI runs goose up twice.

-- finance_accounts links first: the FK, the indexes and the not-blank check
-- all hang off these two columns and go away with them.
ALTER TABLE app.finance_accounts
  DROP COLUMN IF EXISTS plaid_item_id,
  DROP COLUMN IF EXISTS plaid_account_id;

DROP POLICY IF EXISTS app_plaid_items_owner_policy ON app.plaid_items;
DROP TRIGGER IF EXISTS app_plaid_items_set_updated_at ON app.plaid_items;
DROP TABLE IF EXISTS app.plaid_items;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Structure only: dropped rows (and their access tokens) are not coming back.
CREATE TABLE IF NOT EXISTS app.plaid_items (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  institution_id uuid REFERENCES app.finance_institutions(id) ON DELETE SET NULL,
  provider_item_id text NOT NULL,
  cursor text,
  access_token text,
  status text NOT NULL DEFAULT 'healthy',
  error_code text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_plaid_items_access_token_not_blank CHECK (
    access_token IS NULL OR length(btrim(access_token)) > 0
  ),
  CONSTRAINT app_plaid_items_error_code_not_blank CHECK (
    error_code IS NULL OR length(btrim(error_code)) > 0
  ),
  CONSTRAINT app_plaid_items_provider_item_id_not_blank CHECK (
    length(btrim(provider_item_id)) > 0
  ),
  CONSTRAINT app_plaid_items_status_check CHECK (
    status = ANY (ARRAY['healthy', 'needs_attention', 'error', 'revoked'])
  )
);

CREATE INDEX IF NOT EXISTS app_plaid_items_institution_id_idx
  ON app.plaid_items (institution_id);
CREATE INDEX IF NOT EXISTS app_plaid_items_owner_status_idx
  ON app.plaid_items (user_id, status);

DROP TRIGGER IF EXISTS app_plaid_items_set_updated_at ON app.plaid_items;
CREATE TRIGGER app_plaid_items_set_updated_at
  BEFORE UPDATE ON app.plaid_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_snake();

ALTER TABLE app.plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.plaid_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_plaid_items_owner_policy ON app.plaid_items;
CREATE POLICY app_plaid_items_owner_policy ON app.plaid_items
  USING (auth.is_service_role() OR (user_id = auth.current_user_id()))
  WITH CHECK (auth.is_service_role() OR (user_id = auth.current_user_id()));

ALTER TABLE app.finance_accounts
  ADD COLUMN IF NOT EXISTS plaid_item_id uuid REFERENCES app.plaid_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plaid_account_id text;

CREATE INDEX IF NOT EXISTS app_finance_accounts_plaid_item_id_idx
  ON app.finance_accounts (plaid_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS app_finance_accounts_owner_provider_account_key
  ON app.finance_accounts (user_id, provider, plaid_account_id)
  WHERE provider IS NOT NULL AND plaid_account_id IS NOT NULL;
ALTER TABLE app.finance_accounts
  DROP CONSTRAINT IF EXISTS app_finance_accounts_provider_account_id_not_blank,
  ADD CONSTRAINT app_finance_accounts_provider_account_id_not_blank CHECK (
    plaid_account_id IS NULL OR length(btrim(plaid_account_id)) > 0
  );

-- +goose StatementEnd
