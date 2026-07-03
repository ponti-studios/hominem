import type { AccountWithPlaidInfo } from '@hominem/rpc/types/finance.types';

/**
 * Account type - represents a financial account from the API
 * Uses AccountWithPlaidInfo to include Plaid metadata for enriched account details
 */
export type Account = AccountWithPlaidInfo;
