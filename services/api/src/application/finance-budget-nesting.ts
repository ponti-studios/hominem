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
  const result = previewNestedBudgets(input);
  if (result.overageCents <= 0) return;
  throw new ValidationError(
    `Tag budgets in "${input.categoryName}" total ${result.tagBudgetSumCents} cents (${input.categoryCadence}), which exceeds the category budget of ${input.categoryBudgetCents} cents by ${result.overageCents} cents. Reduce the tag budgets or raise the category budget; nothing was saved.`,
    {
      categoryName: input.categoryName,
      categoryCadence: input.categoryCadence,
      tagBudgetSumCents: result.tagBudgetSumCents,
      categoryBudgetCents: input.categoryBudgetCents,
      overageCents: result.overageCents,
    },
  );
}

export function previewNestedBudgets(input: {
  categoryName: string;
  categoryBudgetCents: number | null;
  categoryCadence: FinanceBudgetCadence;
  tagBudgets: readonly NestedTagBudgetInput[];
}): { valid: boolean; tagBudgetSumCents: number; overageCents: number; message: string | null } {
  const tagBudgetSumCents = input.tagBudgets.reduce(
    (sum, budget) =>
      sum + budgetAmountInCadence(budget.amountCents, budget.cadence, input.categoryCadence),
    0,
  );
  const overageCents =
    input.categoryBudgetCents === null
      ? tagBudgetSumCents
      : tagBudgetSumCents - input.categoryBudgetCents;
  const valid = input.categoryBudgetCents !== null ? overageCents <= 0 : tagBudgetSumCents === 0;
  const message = valid
    ? null
    : input.categoryBudgetCents === null
      ? `Tag budgets in "${input.categoryName}" need a category budget; none was saved.`
      : `Tag budgets in "${input.categoryName}" total ${tagBudgetSumCents} cents (${input.categoryCadence}), exceeding the category budget of ${input.categoryBudgetCents} cents by ${overageCents} cents.`;
  return { valid, tagBudgetSumCents, overageCents, message };
}
