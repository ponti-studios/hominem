import { NotFoundError } from '@hominem/db/errors';

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
      'Create the budget for a category (omit tagId), or a tag budget nested inside that category (set tagId), or update that scope’s existing budget if one exists — a category has one budget and each tag inside it has one. The budget carries its own cadence (weekly, monthly, quarterly, annual) and its period is the matching calendar period. It has no currency of its own: the amount is in the profile primary currency, and spent is computed from transactions at read time. A save that would make the category’s tag budgets add up to more than its category budget is rejected in full. Set dryRun to preview the complete projected set and nested-sum validation without writing.',
    inputSchema: financeBudgetCreateInputSchema,
    outputSchema: financeBudgetCreateOutputSchema,
    readOnly: false,
    scopes: ['finance:write'],
    destructive: false,
    idempotent: true,
    resultCap: 10,
    guidance: {
      whenToUse:
        'The user states a spending limit for a spending category, e.g. "keep travel to £4,000 a year", or for a tag inside it, e.g. "£80 a month on coffee within food".',
      whenNotToUse:
        'Do not pass a currency — the budget uses the profile primary currency, set with finance_primary_currency_set. When setting a category together with several of its tag budgets, use finance_budget_set so the whole set is validated and saved atomically.',
      dependencies: [
        {
          tool: 'finance_categories',
          reason: 'resolve the category id, since every budget belongs to a category',
          provides: ['id'],
        },
        {
          tool: 'finance_tag_breakdown',
          reason: 'resolve the tag id when budgeting a tag inside the category',
          provides: ['tag ids'],
        },
      ],
      produces: ['budget', 'current period status'],
    },
  },
  async (ownerUserId, input) => {
    const result = await createBudget(ownerUserId, input);
    if (result.reason === 'unknown_category') {
      throw new NotFoundError('Finance category', { reason: 'unknown_category' });
    }
    return result;
  },
);
