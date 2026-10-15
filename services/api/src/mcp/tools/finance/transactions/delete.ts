import { ValidationError } from '@hominem/db/errors';
import { deleteTransactionsByIds } from '@hominem/finance-services';

import {
  financeTransactionDeleteInputSchema,
  financeTransactionDeleteOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeTransactionDeleteTool = defineMcpTool(
  {
    readOnly: false,
    scopes: ['finance:write'],
    destructive: true,
    idempotent: true,
    standaloneWrite: true,
    requiresConfirmation: true,
    name: 'finance_transaction_delete',
    title: 'Finance Transaction Delete',
    description:
      'Hard-delete finance transactions by id (1–200). Requires iUnderstand: true — that flag is the confirmation contract and the server never elicits on top of it. Unknown ids come back in notFound, never as an error.',
    inputSchema: financeTransactionDeleteInputSchema,
    outputSchema: financeTransactionDeleteOutputSchema,
    resultCap: 200,
    guidance: {
      whenToUse: 'Removing a synthetic, duplicate or bad-sync transaction by id.',
      whenNotToUse: 'Do not guess ids; resolve them via finance_transaction_search first.',
      dependencies: [
        {
          tool: 'finance_transaction_search',
          reason: 'resolve the stable transaction id',
          provides: ['id'],
        },
      ],
    },
    preview: async () => null,
  },
  async (ownerUserId, input) => {
    if (!input.iUnderstand) throw new ValidationError('confirmation_required');
    const { deleted, notFound } = await deleteTransactionsByIds(ownerUserId, input.ids);
    return {
      deleted: deleted.map((transaction) => ({
        id: transaction.id,
        postedOn: transaction.postedOn,
        accountId: transaction.accountId,
        description: transaction.description,
        amount: transaction.amount,
        currencyCode: transaction.currencyCode,
      })),
      notFound,
    };
  },
);
