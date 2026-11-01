import { createBudget } from '../../../../application/finance-budgets.service';
import {
  financeBudgetCreateInputSchema,
  financeBudgetCreateOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeBudgetCreateTool = defineMcpTool(
  {
    name: 'finance_budget_create',
    title: 'Finance Budget Create',
    description:
      'Create the single budget for a category, or update that category’s existing budget if one exists — a category never has two budgets. The budget carries its own cadence (weekly, monthly, quarterly, annual) and its period is the matching calendar period. It has no currency of its own: the amount is in the profile primary currency, and spent is computed from transactions at read time.',
    inputSchema: financeBudgetCreateInputSchema,
    outputSchema: financeBudgetCreateOutputSchema,
    readOnly: false,
    scopes: ['finance:write'],
    destructive: false,
    idempotent: true,
    resultCap: 10,
    guidance: {
      whenToUse:
        'The user states a spending limit for a spending category, e.g. "keep travel to £4,000 a year".',
      whenNotToUse:
        'Do not create tag-level or merchant-level budgets (they do not exist), and do not pass a currency — the budget uses the profile primary currency. Set that with finance_primary_currency_set first if it is not set.',
      dependencies: [
        {
          tool: 'finance_categories',
          reason: 'resolve the category id, since budgets exist only at category level',
          provides: ['id'],
        },
      ],
      produces: ['budget', 'current period status'],
    },
  },
  async (ownerUserId, input) => createBudget(ownerUserId, input),
);
