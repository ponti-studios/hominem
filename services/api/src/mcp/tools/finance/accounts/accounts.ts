import { getFinanceAccountList } from '@hominem/finance-services';

import {
  financeAccountsInputSchema,
  financeMcpAccountsOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

const MAX_ACCOUNTS_RESULT = 50;

export const financeAccountsTool = defineMcpTool(
  {
    name: 'finance_accounts',
    title: 'Finance Accounts',
    description:
      'List finance accounts with type, currency, lifecycle status and current balance (posted transactions only). ' +
      'Unlike finance_net_worth this includes accounts left out of net-worth totals, such as credit cards.',
    inputSchema: financeAccountsInputSchema,
    outputSchema: financeMcpAccountsOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: MAX_ACCOUNTS_RESULT,
    guidance: {
      whenToUse: 'The user asks which accounts they have, or an account id is needed as a filter.',
      whenNotToUse: 'Do not use for net worth totals; use finance_net_worth.',
      produces: ['account ids', 'account names', 'account balances'],
    },
  },
  async (ownerUserId, input) => {
    const result = await getFinanceAccountList(ownerUserId, {
      ...input,
      limit: MAX_ACCOUNTS_RESULT,
    });
    return {
      ...result,
      accounts: result.accounts.map((account) => ({
        ...account,
        balance: account.balanceCents / 100,
      })),
    };
  },
);
