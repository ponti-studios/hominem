import { ValidationError } from '@hominem/db/errors';
import { budgetAmountInCadence, type FinanceBudgetCadence } from '@hominem/db/finance';

export type NestedTagBudgetInput = {
  amountCents: number;
  cadence: FinanceBudgetCadence;
};

/**
 * The nested-budget invariant: inside a category the tag budgets may not add up to more than the
 * category budget. It is checked at save time and never clamped — a rejected save writes nothing
 * — and a sum below the category budget is valid, because the remainder is simply unallocated.
 *
 * Tag budgets carry their own cadence, so each is converted to the category budget's cadence
 * before summing (52 weekly, 12 monthly, 4 quarterly, 1 annual period a year).
 */
export function validateNestedBudgets(input: {
  categoryName: string;
  categoryBudgetCents: number;
  categoryCadence: FinanceBudgetCadence;
  tagBudgets: readonly NestedTagBudgetInput[];
}): void {
  const tagBudgetSumCents = input.tagBudgets.reduce(
    (sum, budget) =>
      sum + budgetAmountInCadence(budget.amountCents, budget.cadence, input.categoryCadence),
    0,
  );
  const overageCents = tagBudgetSumCents - input.categoryBudgetCents;
  if (overageCents <= 0) return;
  throw new ValidationError(
    `Tag budgets in "${input.categoryName}" total ${tagBudgetSumCents} cents (${input.categoryCadence}), which exceeds the category budget of ${input.categoryBudgetCents} cents by ${overageCents} cents. Reduce the tag budgets or raise the category budget; nothing was saved.`,
    {
      categoryName: input.categoryName,
      categoryCadence: input.categoryCadence,
      tagBudgetSumCents,
      categoryBudgetCents: input.categoryBudgetCents,
      overageCents,
    },
  );
}
