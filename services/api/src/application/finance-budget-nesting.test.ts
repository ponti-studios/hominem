import { ValidationError } from '@hominem/db/errors';
import { describe, expect, it } from 'vitest';

import { validateNestedBudgets } from './finance-budget-nesting';

const category = { categoryName: 'Food', categoryCadence: 'monthly' } as const;

function rejection(input: Parameters<typeof validateNestedBudgets>[0]): ValidationError {
  try {
    validateNestedBudgets(input);
  } catch (error) {
    if (error instanceof ValidationError) return error;
    throw error;
  }
  throw new Error('Expected the nested-budget validator to reject the save');
}

describe('validateNestedBudgets', () => {
  it('passes when the tag budgets sum to exactly the category budget', () => {
    expect(() =>
      validateNestedBudgets({
        ...category,
        categoryBudgetCents: 30_000,
        tagBudgets: [
          { amountCents: 10_000, cadence: 'monthly' },
          { amountCents: 20_000, cadence: 'monthly' },
        ],
      }),
    ).not.toThrow();
  });

  it('passes below the category budget: the remainder is simply unallocated', () => {
    expect(() =>
      validateNestedBudgets({
        ...category,
        categoryBudgetCents: 30_000,
        tagBudgets: [{ amountCents: 1, cadence: 'monthly' }],
      }),
    ).not.toThrow();
  });

  it('blocks a tag sum one cent over the category budget and names the overage', () => {
    const error = rejection({
      ...category,
      categoryBudgetCents: 30_000,
      tagBudgets: [
        { amountCents: 10_000, cadence: 'monthly' },
        { amountCents: 20_001, cadence: 'monthly' },
      ],
    });

    expect(error.message).toContain('Food');
    expect(error.message).toContain('30001');
    expect(error.message).toContain('30000');
    expect(error.message).toContain('1');
    expect(error.details).toMatchObject({
      categoryName: 'Food',
      categoryCadence: 'monthly',
      tagBudgetSumCents: 30_001,
      categoryBudgetCents: 30_000,
      overageCents: 1,
    });
  });

  it('converts every tag budget to the category cadence before summing', () => {
    // 1,000 a week is 1,000 * 52 / 12 = 4,333.33 a month, rounded to 4,333 cents.
    expect(() =>
      validateNestedBudgets({
        ...category,
        categoryBudgetCents: 9_333,
        tagBudgets: [
          { amountCents: 5_000, cadence: 'monthly' },
          { amountCents: 1_000, cadence: 'weekly' },
        ],
      }),
    ).not.toThrow();

    expect(() =>
      validateNestedBudgets({
        ...category,
        categoryBudgetCents: 9_332,
        tagBudgets: [
          { amountCents: 5_000, cadence: 'monthly' },
          { amountCents: 1_000, cadence: 'weekly' },
        ],
      }),
    ).toThrow(/exceeds the category budget/i);
  });

  it('passes when there are no tag budgets at all', () => {
    expect(() =>
      validateNestedBudgets({ ...category, categoryBudgetCents: 30_000, tagBudgets: [] }),
    ).not.toThrow();
  });
});
