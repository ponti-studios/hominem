-- +goose Up
CREATE TABLE IF NOT EXISTS public.finance_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  balance NUMERIC(14,2) DEFAULT 0,
  data JSONB DEFAULT '{}',
  institution_id UUID,
  plaid_item_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  account_id UUID NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  description TEXT,
  date TIMESTAMPTZ,
  posted_on TIMESTAMPTZ,
  occurred_at TIMESTAMPTZ,
  external_id TEXT,
  category TEXT,
  merchant_name TEXT,
  notes TEXT,
  transaction_type TEXT,
  pending BOOLEAN DEFAULT false,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  institution_id UUID,
  cursor TEXT,
  access_token TEXT,
  status TEXT DEFAULT 'healthy',
  last_synced_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  description TEXT,
  icon TEXT,
  path TEXT,
  slug TEXT
);

CREATE TABLE IF NOT EXISTS public.tagged_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  assigned_by_userid TEXT,
  assignment_source TEXT DEFAULT 'user',
  assignment_period TEXT,
  confidence NUMERIC(4,3),
  removed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.budget_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  category_id UUID,
  target_amount NUMERIC(14,2) NOT NULL,
  target_period TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  provider TEXT,
  provider_institution_id TEXT,
  country_code TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_finance_accounts_user ON public.finance_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_user ON public.finance_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_account ON public.finance_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_user ON public.plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_owner ON public.tags(owner_id);
CREATE INDEX IF NOT EXISTS idx_tagged_items_entity ON public.tagged_items(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tagged_items_tag ON public.tagged_items(tag_id);
CREATE INDEX IF NOT EXISTS idx_budget_goals_user ON public.budget_goals(user_id);

-- +goose Down
DROP TABLE IF EXISTS public.budget_goals;
DROP TABLE IF EXISTS public.tagged_items;
DROP TABLE IF EXISTS public.tags;
DROP TABLE IF EXISTS public.plaid_items;
DROP TABLE IF EXISTS public.finance_transactions;
DROP TABLE IF EXISTS public.finance_accounts;
DROP TABLE IF EXISTS public.financial_institutions;
