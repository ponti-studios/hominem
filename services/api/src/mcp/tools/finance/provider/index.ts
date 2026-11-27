import { financeBalances, financeSeed } from '../../../../application/finance.provider.service';
import {
  financeBalancesInputSchema,
  financeBalancesOutputSchema,
  financeSeedInputSchema,
  financeSeedOutputSchema,
} from '../../../../schemas/finance.provider.schema';
import { defineMcpSlice, defineMcpTool } from '../../../tool-registry';

export const financeProviderSlice = defineMcpSlice({
  name: 'finance.provider',
  tools: [
    defineMcpTool(
      {
        name: 'finance_seed',
        title: 'Seed finance accounts and doctrine',
        description:
          'Provision owner-scoped Starling account identities and optionally import the sync doctrine. Never sends bank credentials.',
        inputSchema: financeSeedInputSchema,
        outputSchema: financeSeedOutputSchema,
        readOnly: false,
        scopes: ['finance:write'],
        destructive: false,
        idempotent: true,
        standaloneWrite: true,
        resultCap: 500,
      },
      (userId, input) => financeSeed(userId, input),
    ),
    defineMcpTool(
      {
        name: 'finance_balances',
        title: 'Finance live balances',
        description:
          'Normalize a caller-provided Starling balance snapshot and report cleared balances plus Spaces separately by currency.',
        inputSchema: financeBalancesInputSchema,
        outputSchema: financeBalancesOutputSchema,
        readOnly: true,
        scopes: ['finance:read'],
        resultCap: 500,
      },
      (_userId, input) => Promise.resolve(financeBalances(input)),
    ),
  ],
});
