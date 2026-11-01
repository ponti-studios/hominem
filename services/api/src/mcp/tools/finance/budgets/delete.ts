import { deleteBudget, getBudgetPreview } from '../../../../application/finance-budgets.service';
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
      'Delete a category budget. The budget’s transactions are untouched — a budget is a limit, not a movement of money. The MCP server asks for confirmation before deletion.',
    inputSchema: financeBudgetDeleteInputSchema,
    outputSchema: financeBudgetDeleteOutputSchema,
    readOnly: false,
    scopes: ['finance:write'],
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    resultCap: 1,
    guidance: {
      whenToUse: 'The user no longer wants a budget for that category.',
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
            amountCents: budget.amountCents,
            cadence: budget.cadence,
          }
        : null;
    },
  },
  async (ownerUserId, input) => deleteBudget(ownerUserId, input.budgetId),
);
