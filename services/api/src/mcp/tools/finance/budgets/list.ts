import { listBudgets } from '../../../../application/finance-budgets.service';
import {
  financeBudgetListInputSchema,
  financeBudgetListOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeBudgetListTool = defineMcpTool(
  {
    name: 'finance_budget_list',
    title: 'Finance Budget List',
    description:
      'List every category budget with its current period status: period bounds, opening balance, available, spent in the category, remaining, swept-to-savings and the pace projection. Each budget reports against its own cadence’s calendar period. Spent is computed from transactions at read time.',
    inputSchema: financeBudgetListInputSchema,
    outputSchema: financeBudgetListOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 50,
    guidance: {
      whenToUse: 'The user asks how their budgets are doing, or what budgets exist.',
      whenNotToUse: 'Do not use for transaction history or category-level spending reports.',
      produces: [
        'budgets',
        'current period bounds',
        'spent and remaining per budget',
        'pace projection',
      ],
    },
  },
  async (ownerUserId) => listBudgets(ownerUserId),
);
