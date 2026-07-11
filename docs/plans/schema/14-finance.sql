-- Up: finance_* naming; amount lives on both the transaction and its postings (see decision note).
-- NOTE: institutions/accounts/transactions/plaid_items use created_at/updated_at (underscored); every other
-- table in this file uses createdAt/updatedAt. This inconsistency is real in production, not a transcription slip.
CREATE TABLE app.finance_institutions (
  id uuid PRIMARY KEY DEFAULT uuidv7(), provider text, provider_institution_id text, name text NOT NULL CHECK (btrim(name) <> ''),
  website_url text, logo_url text, country_code text CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.finance_accounts (
  id uuid PRIMARY KEY DEFAULT uuidv7(), user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, institution_id uuid REFERENCES app.finance_institutions(id) ON DELETE SET NULL,
  plaid_item_id uuid, name text NOT NULL CHECK (btrim(name) <> ''), account_type text NOT NULL CHECK (btrim(account_type) <> ''), account_subtype text,
  currency_code text NOT NULL DEFAULT 'USD' CHECK (currency_code ~ '^[A-Z]{3}$'),
  current_balance numeric(14,2), available_balance numeric(14,2), provider text, plaid_account_id text, mask text,
  is_active boolean NOT NULL DEFAULT true, metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (current_balance IS NULL OR available_balance IS NULL OR available_balance <= current_balance)
);
CREATE TABLE app.plaid_items (
  id uuid PRIMARY KEY DEFAULT uuidv7(), user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, institution_id uuid REFERENCES app.finance_institutions(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'plaid' CHECK (btrim(provider) <> ''), provider_item_id text NOT NULL CHECK (btrim(provider_item_id) <> ''),
  cursor text, access_token text, status text NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy','needs_attention','error','revoked')),
  error_code text, error_message text, last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.finance_accounts ADD CONSTRAINT finance_accounts_plaid_item_id_fkey FOREIGN KEY (plaid_item_id) REFERENCES app.plaid_items(id) ON DELETE SET NULL;
CREATE TABLE app.finance_merchants (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''), normalized_name text NOT NULL CHECK (btrim(normalized_name) <> ''), website_url text, metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.finance_categories (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, parent_id uuid REFERENCES app.finance_categories(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (btrim(name) <> ''), kind text NOT NULL DEFAULT 'expense' CHECK (kind IN ('income','expense','transfer','asset','liability')),
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
-- amount is intentionally present on both the transaction and its postings; see 14-finance.md divergence note.
CREATE TABLE app.finance_transactions (
  id uuid PRIMARY KEY DEFAULT uuidv7(), user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, account_id uuid NOT NULL REFERENCES app.finance_accounts(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL, transaction_type text NOT NULL CHECK (transaction_type IN ('debit','credit','transfer','adjustment')),
  description text, merchant_name text, posted_on date NOT NULL, occurred_at timestamptz, pending boolean NOT NULL DEFAULT false,
  source text, external_id text, notes text, provider_payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.finance_transaction_postings (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES app.finance_transactions(id) ON DELETE CASCADE, account_id uuid REFERENCES app.finance_accounts(id) ON DELETE SET NULL,
  category_id uuid REFERENCES app.finance_categories(id) ON DELETE SET NULL, amount numeric(14,2) NOT NULL, currency_code text NOT NULL DEFAULT 'USD', memo text,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.finance_statement_periods (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, account_id uuid NOT NULL REFERENCES app.finance_accounts(id) ON DELETE CASCADE,
  starts_on date NOT NULL, ends_on date NOT NULL, opening_balance numeric(14,2), closing_balance numeric(14,2), statement_file_id uuid REFERENCES app.files(id) ON DELETE SET NULL,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(), CHECK (ends_on >= starts_on)
);
CREATE INDEX idx_finance_transactions_owner_occurred ON app.finance_transactions(user_id, posted_on DESC);
