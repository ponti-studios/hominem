import { upsertFinanceTransaction } from '../../../../application/finance.service';
import {
  financeTransactionUpsertInputSchema,
  financeTransactionUpsertOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeTransactionUpsertTool = defineMcpTool(
  {
    readOnly: false,
    scopes: ['finance:write'],
    destructive: false,
    idempotent: true,
    standaloneWrite: true,
    name: 'finance_transaction_upsert',
    title: 'Finance Transaction Upsert',
    description:
      'Upsert a single finance transaction. Without externalId, identity is derived from postedOn, account, description, amountCents and currencyCode; when externalId is supplied, that provider identity is used. Unknown accounts are rejected, never auto-created. A rejected row returns reason and null id instead of failing the call.',
    inputSchema: financeTransactionUpsertInputSchema,
    outputSchema: financeTransactionUpsertOutputSchema,
    resultCap: 1,
    guidance: {
      whenToUse: 'Pushing one sheet row or correcting a single transaction.',
      whenNotToUse: 'Do not invent account labels; resolve them via finance_accounts first.',
      dependencies: [
        { tool: 'finance_accounts', reason: 'resolve the account id', provides: ['id'] },
      ],
    },
  },
  async (ownerUserId, input) => upsertFinanceTransaction(ownerUserId, input),
);
