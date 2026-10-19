import { NotFoundError, ValidationError } from '@hominem/db/errors';
import { deleteEmptyAccount } from '@hominem/finance-services';

import {
  financeAccountDeleteInputSchema,
  financeAccountDeleteOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeAccountDeleteTool = defineMcpTool(
  {
    name: 'finance_account_delete',
    title: 'Finance Account Delete',
    description:
      'Permanently delete an empty account by id. Accounts with transactions cannot be deleted. Requires iUnderstand: true; the server never elicits confirmation.',
    inputSchema: financeAccountDeleteInputSchema,
    outputSchema: financeAccountDeleteOutputSchema,
    readOnly: false,
    scopes: ['finance:write'],
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    resultCap: 1,
    guidance: {
      whenToUse: 'Removing an empty test or duplicate account permanently.',
      whenNotToUse: 'Do not delete an account with transactions; move or delete those first.',
      dependencies: [
        {
          tool: 'finance_account_summary',
          reason: 'verify the account is empty',
          provides: ['accountId'],
        },
      ],
    },
    preview: async (_ownerUserId, input) => {
      financeAccountDeleteInputSchema.safeParse(input);
      return null;
    },
  },
  async (ownerUserId, input) => {
    if (!input.iUnderstand) throw new ValidationError('confirmation_required');

    const result = await deleteEmptyAccount(input.accountId, ownerUserId);
    if (!result.account) {
      if (result.transactionCount > 0) {
        throw new ValidationError(
          `account_not_empty: ${result.transactionCount} transaction(s) reference this account.`,
          { reason: 'account_not_empty', transactionCount: result.transactionCount },
        );
      }
      throw new NotFoundError('Account', { reason: 'account_not_found' });
    }

    return { deleted: result.account };
  },
);
