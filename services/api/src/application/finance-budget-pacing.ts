import { budgetAmountInCadence, type FinanceBudgetCadence } from '@hominem/db/finance';

/**
 * A tag budget measured against its own amount. This is composition information — how the
 * category is made up — and is never a breach. The category budget is the only breach line, so
 * this type deliberately has no `breach` field: a consumer cannot turn a tag overage into an
 * exception without inventing one.
 */
export type TagBudgetComposition = {
  tagId: string;
  tagName: string;
  amountCents: number;
  cadence: FinanceBudgetCadence;
  /** The tag amount in the category budget's cadence, for comparing composition with the total. */
  amountInCategoryCadenceCents: number;
  /** Spent on that tag in the tag budget's own current period. */
  spentCents: number;
  remainingCents: number;
  /** True when the tag is over its own amount. Composition, not a breach. */
  overTagBudget: boolean;
};

export type BudgetBreach = {
  categoryId: string;
  categoryName: string;
  overByCents: number;
};

export type CategoryBudgetPacing = {
  categoryId: string;
  categoryName: string;
  availableCents: number;
  spentCents: number;
  /** The category budget is the breach line: set only when the category is over it. */
  breach: BudgetBreach | null;
  composition: TagBudgetComposition[];
};

/**
 * The pacing rule for nested budgets: a category budget is the breach line, and tag budgets are
 * composition only. A tag over its own budget while the category is within budget therefore
 * yields no breach, and a category over budget yields a breach however the spend is distributed
 * across tags.
 */
export function evaluateCategoryBudgetPacing(input: {
  categoryId: string;
  categoryName: string;
  categoryCadence: FinanceBudgetCadence;
  availableCents: number;
  spentCents: number;
  tagBudgets: ReadonlyArray<{
    tagId: string;
    tagName: string;
    amountCents: number;
    cadence: FinanceBudgetCadence;
    spentCents: number;
  }>;
}): CategoryBudgetPacing {
  const overByCents = input.spentCents - input.availableCents;
  return {
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    availableCents: input.availableCents,
    spentCents: input.spentCents,
    breach:
      overByCents > 0
        ? { categoryId: input.categoryId, categoryName: input.categoryName, overByCents }
        : null,
    composition: input.tagBudgets.map((tag) => ({
      tagId: tag.tagId,
      tagName: tag.tagName,
      amountCents: tag.amountCents,
      cadence: tag.cadence,
      amountInCategoryCadenceCents: budgetAmountInCadence(
        tag.amountCents,
        tag.cadence,
        input.categoryCadence,
      ),
      spentCents: tag.spentCents,
      remainingCents: tag.amountCents - tag.spentCents,
      overTagBudget: tag.spentCents > tag.amountCents,
    })),
  };
}
