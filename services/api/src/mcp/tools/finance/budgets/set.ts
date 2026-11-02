import { NotFoundError } from '@hominem/db/errors';

import { setCategoryBudgets } from '../../../../application/finance-budgets.service';
import {
  financeBudgetSetInputSchema,
  financeBudgetSetOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeBudgetSetTool = defineMcpTool(
  {
    name: 'finance_budget_set',
    title: 'Finance Budget Set',
    description:
      'Save a category budget together with the complete set of tag budgets nested inside it, in one transaction. Either everything is saved or nothing is: if the tag budgets add up to more than the category budget the save is rejected with the overage named and the stored budgets are unchanged. Tag amounts below the category budget are fine — the remainder is simply unallocated. Set dryRun to inspect the full projected set and nested-sum validation without writing.',
    inputSchema: financeBudgetSetInputSchema,
    outputSchema: financeBudgetSetOutputSchema,
    readOnly: false,
    scopes: ['finance:write'],
    destructive: false,
    idempotent: true,
    resultCap: 10,
    guidance: {
      whenToUse:
        'The user sets a total for a category and budgets some of its tags beneath it, e.g. a food total with grocery, restaurant and coffee components.',
      whenNotToUse:
        'Do not use for a single budget change with no tag composition — finance_budget_create and finance_budget_update are enough there.',
      dependencies: [
        {
          tool: 'finance_categories',
          reason: 'resolve the category id',
          provides: ['id'],
        },
        {
          tool: 'finance_tag_breakdown',
          reason: 'resolve the tags used inside the category',
          provides: ['tag ids'],
        },
      ],
      produces: ['category budget status', 'tag composition', 'breach when the category is over'],
    },
  },
  async (ownerUserId, input) => {
    const result = await setCategoryBudgets(ownerUserId, input);
    if (result.reason === 'unknown_category') {
      throw new NotFoundError('Finance category', { reason: 'unknown_category' });
    }
    return result;
  },
);
