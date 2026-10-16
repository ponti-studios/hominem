import { getFinanceRecentTransactions } from '@hominem/finance-services';

import {
  financeRecentTransactionsInputSchema,
  financeRecentTransactionsOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeRecentTransactionsTool = defineMcpTool(
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
  async (ownerUserId, input) => {
    const result = await getFinanceRecentTransactions(ownerUserId, input);
    return {
      ...result,
      transactions: result.transactions.map((transaction) => ({
        ...transaction,
        amount: transaction.amountCents / 100,
      })),
    };
  },
);
