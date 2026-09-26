import {
  getFinanceNetWorth,
  getFinanceRecentTransactions,
  getFinanceSpendingByCategory,
} from '@hominem/finance-services';

import {
  financeNetWorthInputSchema,
  financeNetWorthOutputSchema,
  financeRecentTransactionsInputSchema,
  financeRecentTransactionsOutputSchema,
  financeSpendingByCategoryInputSchema,
  financeSpendingByCategoryOutputSchema,
} from '../../schemas/finance.schema';
import { registerTool } from '../tool-registry';

registerTool(
  {
    name: 'finance_net_worth',
    title: 'Finance Net Worth',
    description:
      'Compute current net worth from finance accounts included in net-worth totals, summing posted transaction activity per account. Returns per-account balances grouped by currency.',
    inputSchema: financeNetWorthInputSchema,
    outputSchema: financeNetWorthOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 50,
    guidance: {
      whenToUse: 'The user asks for current net worth or account balances.',
      whenNotToUse: 'Do not use for transaction history or category spending.',
      produces: ['account balances', 'net worth totals'],
    },
  },
  async (ownerUserId, input) => getFinanceNetWorth(ownerUserId, input.includeClosed),
);

registerTool(
  {
    name: 'finance_recent_transactions',
    title: 'Finance Recent Transactions',
    description:
      'List posted finance transactions in a bounded window, optionally scoped to one account, with category annotations where available.',
    inputSchema: financeRecentTransactionsInputSchema,
    outputSchema: financeRecentTransactionsOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 50,
    guidance: {
      whenToUse: 'The user asks for recent transactions or spending evidence.',
      whenNotToUse: 'Do not use for net worth or category aggregation.',
      produces: ['transaction ids', 'transaction dates', 'merchant names', 'amounts'],
    },
  },
  async (ownerUserId, input) => getFinanceRecentTransactions(ownerUserId, input),
);

registerTool(
  {
    name: 'finance_spending_by_category',
    title: 'Finance Spending by Category',
    description:
      'Sum posted, non-excluded, non-transfer spending grouped by category over a date range. Returns spend totals in cents.',
    inputSchema: financeSpendingByCategoryInputSchema,
    outputSchema: financeSpendingByCategoryOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 50,
  },
  async (ownerUserId, input) => getFinanceSpendingByCategory(ownerUserId, input),
);
