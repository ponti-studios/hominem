import type { Json, Numeric, Timestamp } from './database';

export interface LegacyFinanceAccounts {
  id: string;
  user_id: string;
  name: string;
  account_type: string;
  balance: Numeric | number | string;
  data: Json | null;
  institution_id?: string | null;
  plaid_item_id?: string | null;
  created_at?: Timestamp | null;
  updated_at?: Timestamp | null;
}

export interface LegacyFinanceTransactions {
  id: string;
  user_id: string;
  account_id: string;
  amount: Numeric | number | string;
  description: string | null;
  date?: Timestamp | string | null;
  posted_on?: Timestamp | string | null;
  occurred_at?: Timestamp | string | null;
  external_id?: string | null;
  category?: string | null;
  merchant_name?: string | null;
  notes?: string | null;
  transaction_type?: string | null;
  pending?: boolean;
  source?: string | null;
  created_at?: Timestamp | null;
  updated_at?: Timestamp | null;
}

export interface LegacyPlaidItems {
  id: string;
  user_id: string;
  item_id: string;
  institution_id: string | null;
  cursor: string | null;
  access_token: string | null;
  status: string | null;
  last_synced_at: Timestamp | string | null;
  error_code?: string | null;
  error_message?: string | null;
  error?: string | null;
  created_at?: Timestamp | null;
  updated_at?: Timestamp | null;
}

export interface LegacyTags {
  id: string;
  owner_id: string;
  name: string;
  color: string | null;
  description?: string | null;
  icon?: string | null;
  path?: string;
  slug?: string;
}

export interface LegacyTaggedItems {
  id: string;
  tag_id: string;
  entity_id: string;
  entity_type: string;
  assigned_by_userid?: string | null;
  assignment_source?: string;
  assignment_period?: string | null;
  confidence?: Numeric | number | string | null;
  removed_at?: Timestamp | string | null;
}

export interface LegacyBudgetGoals {
  id: string;
  user_id: string;
  category_id: string | null;
  target_amount: Numeric | number | string;
  target_period: string;
  created_at?: Timestamp | null;
}

export interface LegacyFinancialInstitutions {
  id: string;
  name: string;
  logo_url?: string | null;
  website_url?: string | null;
  provider?: string | null;
  provider_institution_id?: string | null;
  country_code?: string | null;
}

export interface LegacyFinanceDB {
  finance_accounts: LegacyFinanceAccounts;
  finance_transactions: LegacyFinanceTransactions;
  plaid_items: LegacyPlaidItems;
  tags: LegacyTags;
  tagged_items: LegacyTaggedItems;
  budget_goals: LegacyBudgetGoals;
  financial_institutions: LegacyFinancialInstitutions;
}
