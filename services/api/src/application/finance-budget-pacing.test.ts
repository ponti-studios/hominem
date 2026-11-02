import { describe, expect, it } from 'vitest';

import { evaluateCategoryBudgetPacing } from './finance-budget-pacing';

const category = {
  categoryId: 'category-food',
  categoryName: 'Food',
  categoryCadence: 'monthly',
  availableCents: 30_000,
} as const;

describe('evaluateCategoryBudgetPacing', () => {
  it('reports a tag over its own budget as composition only while the category is within budget', () => {
    const pacing = evaluateCategoryBudgetPacing({
      ...category,
      spentCents: 12_000,
      tagBudgets: [
        {
          tagId: 'tag-coffee',
          tagName: 'Coffee',
          amountCents: 2_000,
          cadence: 'monthly',
          spentCents: 2_500,
        },
        {
          tagId: 'tag-grocery',
          tagName: 'Grocery',
          amountCents: 10_000,
          cadence: 'monthly',
          spentCents: 9_500,
        },
      ],
    });

    expect(pacing.breach).toBeNull();
    expect(pacing.composition).toEqual([
      expect.objectContaining({
        tagId: 'tag-coffee',
        spentCents: 2_500,
        remainingCents: -500,
        overTagBudget: true,
      }),
      expect.objectContaining({
        tagId: 'tag-grocery',
        spentCents: 9_500,
        remainingCents: 500,
        overTagBudget: false,
      }),
    ]);
  });

  it('reports a breach when the category is over budget, however spend distributes across tags', () => {
    const pacing = evaluateCategoryBudgetPacing({
      ...category,
      spentCents: 35_000,
      tagBudgets: [
        // Every tag is comfortably within its own amount.
        {
          tagId: 'tag-coffee',
          tagName: 'Coffee',
          amountCents: 2_000,
          cadence: 'monthly',
          spentCents: 0,
        },
        {
          tagId: 'tag-grocery',
          tagName: 'Grocery',
          amountCents: 28_000,
          cadence: 'monthly',
          spentCents: 0,
        },
      ],
    });

    expect(pacing.breach).toEqual({
      categoryId: 'category-food',
      categoryName: 'Food',
      overByCents: 5_000,
    });
    expect(pacing.composition.every((tag) => !tag.overTagBudget)).toBe(true);
  });

  it('reports exactly one breach when both the category and a tag are over', () => {
    const pacing = evaluateCategoryBudgetPacing({
      ...category,
      spentCents: 35_000,
      tagBudgets: [
        {
          tagId: 'tag-coffee',
          tagName: 'Coffee',
          amountCents: 2_000,
          cadence: 'monthly',
          spentCents: 3_000,
        },
      ],
    });

    expect(pacing.breach?.overByCents).toBe(5_000);
    expect(pacing.composition[0]?.overTagBudget).toBe(true);
  });

  it('converts a tag budget to the category cadence for comparison', () => {
    const pacing = evaluateCategoryBudgetPacing({
      ...category,
      spentCents: 0,
      tagBudgets: [
        {
          tagId: 'tag-coffee',
          tagName: 'Coffee',
          amountCents: 1_000,
          cadence: 'weekly',
          spentCents: 0,
        },
      ],
    });

    expect(pacing.composition[0]).toMatchObject({
      amountCents: 1_000,
      cadence: 'weekly',
      amountInCategoryCadenceCents: 4_333,
      remainingCents: 1_000,
    });
  });
});
