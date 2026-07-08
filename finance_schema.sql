-- Finance Schema from warehouse.db
-- Extracted 2026-07-06

-- Accounts
CREATE TABLE IF NOT EXISTS "finance_accounts" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  institution TEXT,
  account_type TEXT NOT NULL DEFAULT 'other'
    CHECK (account_type IN ('checking', 'savings', 'credit_card', 'cash', 'loan', 'investment', 'retirement', 'other')),
  currency_code TEXT NOT NULL DEFAULT 'USD'
    CHECK (length(currency_code) = 3 AND currency_code = upper(currency_code)),
  lifecycle_status TEXT NOT NULL DEFAULT 'open'
    CHECK (lifecycle_status IN ('open', 'closed', 'historical', 'unknown')),
  opened_on TEXT,
  closed_on TEXT,
  include_in_net_worth INTEGER NOT NULL DEFAULT 1
    CHECK (include_in_net_worth IN (0, 1))
);

-- Account labels (canonical names, aliases, historical names)
CREATE TABLE IF NOT EXISTS finance_account_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  label_kind TEXT NOT NULL
    CHECK (label_kind IN ('canonical', 'alias', 'historical_name')),
  institution TEXT,
  effective_from TEXT,
  effective_to TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  confidence REAL NOT NULL DEFAULT 1.0
    CHECK (confidence >= 0 AND confidence <= 1),
  is_generic INTEGER NOT NULL DEFAULT 0
    CHECK (is_generic IN (0, 1)),
  resolves_to_account INTEGER NOT NULL DEFAULT 1
    CHECK (resolves_to_account IN (0, 1)),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK (trim(label) <> '')
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_account_labels_active_resolution
  ON finance_account_labels(lower(trim(label)))
  WHERE resolves_to_account = 1 AND effective_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_finance_account_labels_account
  ON finance_account_labels(account_id, label_kind);
CREATE INDEX IF NOT EXISTS idx_finance_account_labels_kind
  ON finance_account_labels(label_kind);

-- Ledger entries (the core transaction record)
CREATE TABLE IF NOT EXISTS finance_account_ledger_entries (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES finance_accounts(id),
  posted_on TEXT NOT NULL
    CHECK (posted_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  description TEXT NOT NULL,
  balance_delta_cents INTEGER NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'USD'
    CHECK (length(currency_code) = 3 AND currency_code = upper(currency_code)),
  posting_status TEXT NOT NULL DEFAULT 'posted'
    CHECK (posting_status IN ('posted', 'pending')),
  ledger_entry_kind TEXT NOT NULL DEFAULT 'regular'
    CHECK (ledger_entry_kind IN ('regular', 'income', 'internal_transfer', 'adjustment')),
  account_mask TEXT,
  note TEXT,
  source_fingerprint TEXT NOT NULL UNIQUE,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_finance_ledger_entries_account_posted
  ON finance_account_ledger_entries(account_id, posted_on);
CREATE INDEX IF NOT EXISTS idx_finance_ledger_entries_posting_status
  ON finance_account_ledger_entries(posting_status);
CREATE INDEX IF NOT EXISTS idx_finance_ledger_entries_kind
  ON finance_account_ledger_entries(ledger_entry_kind);

-- Ledger entry annotations (categories, exclusion, recurring flags)
CREATE TABLE IF NOT EXISTS finance_ledger_entry_annotations (
  ledger_entry_id INTEGER PRIMARY KEY
    REFERENCES finance_account_ledger_entries(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES finance_categories(id),
  category_assignment_source TEXT NOT NULL DEFAULT 'source'
    CHECK (category_assignment_source IN ('source', 'unmapped', 'manual', 'rule')),
  excluded INTEGER NOT NULL DEFAULT 0 CHECK (excluded IN (0, 1)),
  recurring INTEGER NOT NULL DEFAULT 0 CHECK (recurring IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT
);

-- Statement periods
CREATE TABLE IF NOT EXISTS finance_account_statement_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES finance_accounts(id),
  period_start_on TEXT NOT NULL
    CHECK (period_start_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  period_end_on TEXT NOT NULL
    CHECK (period_end_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  opening_balance_cents INTEGER NOT NULL DEFAULT 0,
  closing_balance_cents INTEGER NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL DEFAULT 'USD'
    CHECK (length(currency_code) = 3 AND currency_code = upper(currency_code)),
  evidence_path TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  note TEXT,
  certification_status TEXT NOT NULL DEFAULT 'uncertified'
    CHECK (certification_status IN ('uncertified', 'certified', 'variance')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (period_start_on <= period_end_on),
  UNIQUE (account_id, period_start_on, period_end_on)
);
CREATE INDEX IF NOT EXISTS idx_finance_statement_periods_account_end
  ON finance_account_statement_periods(account_id, period_end_on);

-- Category hierarchy
CREATE TABLE IF NOT EXISTS finance_categories (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  parent_id INTEGER REFERENCES finance_categories(id),
  UNIQUE (name, parent_id)
);

-- Expenses (legacy table)
CREATE TABLE IF NOT EXISTS finance_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  payee TEXT,
  cost REAL,
  type TEXT,
  billing_period TEXT,
  situation TEXT,
  category TEXT,
  start_date TEXT,
  end_date TEXT
);

-- Incomes (legacy table)
CREATE TABLE IF NOT EXISTS finance_incomes (
  id INTEGER PRIMARY KEY,
  year INTEGER,
  source TEXT,
  location TEXT,
  gross_amount REAL,
  net_amount REAL,
  type TEXT,
  tax_details TEXT
);

-- Credit scores
CREATE TABLE IF NOT EXISTS finance_credit_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  score INTEGER,
  source TEXT,
  bureau TEXT
);

-- Transactions (legacy table)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  description TEXT,
  category TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Runway
CREATE TABLE IF NOT EXISTS runway (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  date TEXT,
  available_funds REAL,
  weight REAL
);
