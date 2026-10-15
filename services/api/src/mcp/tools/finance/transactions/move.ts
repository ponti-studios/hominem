import { moveFinanceTransactions } from '../../../../application/finance.service';
import {
  financeTransactionMoveInputSchema,
  financeTransactionMoveOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeTransactionMoveTool = defineMcpTool(
  {
    name: 'finance_transaction_move',
    title: 'Finance Transaction Move',
    description:
      'Move owned transactions to another owned account while preserving transaction ids and links.',
    inputSchema: financeTransactionMoveInputSchema,
    outputSchema: financeTransactionMoveOutputSchema,
    readOnly: false,
    scopes: ['finance:write'],
    destructive: false,
    idempotent: true,
    standaloneWrite: true,
    resultCap: 200,
    guidance: {
      whenToUse: 'Correct transactions filed under the wrong account.',
      whenNotToUse: 'Do not use to alter transaction values or counterpart links.',
    },
  },
  async (ownerUserId, input) => moveFinanceTransactions(ownerUserId, input.ids, input.toAccount),
);
