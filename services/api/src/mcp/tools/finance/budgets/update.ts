import { updateBudget } from '../../../../application/finance-budgets.service';
import {
  financeBudgetUpdateInputSchema,
  financeBudgetUpdateOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeBudgetUpdateTool = defineMcpTool(
  {
    name: 'finance_budget_update',
    title: 'Finance Budget Update',
    description:
      'Update a budget’s amount and/or cadence. Changing the cadence changes the calendar period the budget is measured over. Returns null when the id is not the caller’s budget.',
    inputSchema: financeBudgetUpdateInputSchema,
    outputSchema: financeBudgetUpdateOutputSchema,
    readOnly: false,
    scopes: ['finance:write'],
    destructive: false,
    idempotent: true,
    resultCap: 1,
    guidance: {
      whenToUse: 'The user changes a budget’s limit or moves it to a different cadence.',
      whenNotToUse: 'Do not use to create a budget; there is one budget per category.',
      dependencies: [
        { tool: 'finance_budget_list', reason: 'resolve the budget id', provides: ['id'] },
      ],
      produces: ['updated budget status'],
    },
  },
  async (ownerUserId, input) => {
    const { budgetId, amountCents, cadence } = input;
    return updateBudget(ownerUserId, budgetId, {
      ...(amountCents === undefined ? {} : { amountCents }),
      ...(cadence === undefined ? {} : { cadence }),
    });
  },
);
