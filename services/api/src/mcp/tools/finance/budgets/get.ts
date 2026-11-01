import { getBudget } from '../../../../application/finance-budgets.service';
import {
  financeBudgetGetInputSchema,
  financeBudgetGetOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeBudgetGetTool = defineMcpTool(
  {
    name: 'finance_budget_get',
    title: 'Finance Budget Get',
    description:
      'Get one category budget with its current period status, computed at read time from transactions in that category. Null when the id is not the caller’s budget.',
    inputSchema: financeBudgetGetInputSchema,
    outputSchema: financeBudgetGetOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 1,
    guidance: {
      whenToUse: 'The user asks about one specific budget by the id finance_budget_list returned.',
      whenNotToUse: 'Do not invent a budget id; list budgets first.',
      dependencies: [
        { tool: 'finance_budget_list', reason: 'resolve the budget id', provides: ['id'] },
      ],
      produces: ['budget status', 'spent and remaining', 'pace projection'],
    },
  },
  async (ownerUserId, input) => getBudget(ownerUserId, input.budgetId),
);
