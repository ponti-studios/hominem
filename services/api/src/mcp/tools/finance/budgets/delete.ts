import { NotFoundError } from '@hominem/db/errors';

import {
  deleteBudget,
  getBudgetPreview,
  MAX_BUDGETS_IN_DELETE_PREVIEW,
} from '../../../../application/finance-budgets.service';
import {
  financeBudgetDeleteInputSchema,
  financeBudgetDeleteOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeBudgetDeleteTool = defineMcpTool(
  {
    name: 'finance_budget_delete',
    title: 'Finance Budget Delete',
    description:
      'Delete a budget — a category budget or one of its tag budgets. Deleting a category budget also deletes the tag budgets nested inside it. The budget’s transactions are untouched — a budget is a limit, not a movement of money. The MCP server asks for confirmation before deletion. Set dryRun to list every affected budget without writing or requesting confirmation.',
    inputSchema: financeBudgetDeleteInputSchema,
    outputSchema: financeBudgetDeleteOutputSchema,
    readOnly: false,
    scopes: ['finance:write'],
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    resultCap: MAX_BUDGETS_IN_DELETE_PREVIEW,
    guidance: {
      whenToUse: 'The user no longer wants a budget for that category or tag.',
      whenNotToUse: 'Do not delete a budget to change its amount or cadence; update it instead.',
      dependencies: [
        { tool: 'finance_budget_list', reason: 'resolve the budget id', provides: ['id'] },
      ],
    },
    preview: async (ownerUserId, input) => {
      const parsed = financeBudgetDeleteInputSchema.safeParse(input);
      if (!parsed.success) return null;
      const budget = await getBudgetPreview(ownerUserId, parsed.data.budgetId);
      return budget
        ? {
            categoryName: budget.categoryName,
            tagName: budget.tagName,
            amountCents: budget.amountCents,
            cadence: budget.cadence,
          }
        : null;
    },
  },
  async (ownerUserId, input) => {
    const result = await deleteBudget(ownerUserId, input.budgetId, { dryRun: input.dryRun });
    if (input.dryRun) {
      if (result.preview.length === 0) throw new NotFoundError('Budget', { reason: 'not_found' });
      return result;
    }
    if (!result.removed) throw new NotFoundError('Budget', { reason: 'not_found' });
    return result;
  },
);
