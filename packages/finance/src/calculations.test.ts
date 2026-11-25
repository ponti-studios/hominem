import { describe, expect, it } from 'vitest';

import {
  affordabilityCheckInputSchema,
  calculateAffordability,
  runwayScenarioInputSchema,
  simulateRunway,
} from './calculations';

describe('runway scenario simulation', () => {
  it('includes scheduled purchases in depletion and the projection', () => {
    const result = simulateRunway(
      runwayScenarioInputSchema.parse({
        balance: 1000,
        monthlyExpenses: 200,
        projectionMonths: 12,
        asOf: '2026-01-31',
        plannedPurchases: [{ description: 'Trip', amount: 300, date: '2026-02-01' }],
      }),
    );

    expect(result.projectionData).toHaveLength(12);
    expect(result.projectionData[0]).toEqual({ month: '2026-02', balance: 500 });
    expect(result.runwayMonths).toBe(4);
    expect(result.runwayEndDate).toBe('2026-05-01T00:00:00.000Z');
  });

  it('reports no depletion within the projection when expenses are zero', () => {
    const result = simulateRunway(
      runwayScenarioInputSchema.parse({
        balance: 100,
        monthlyExpenses: 0,
        asOf: '2026-01-15',
      }),
    );

    expect(result.runwayMonths).toBeNull();
    expect(result.runwayEndDate).toBeNull();
    expect(result.years).toBeNull();
    expect(result.isRunwayDangerous).toBe(false);
  });

  it('ignores purchases dated before the actual as-of day in the current month', () => {
    const result = simulateRunway(
      runwayScenarioInputSchema.parse({
        balance: 1000,
        monthlyExpenses: 100,
        asOf: '2026-10-19',
        plannedPurchases: [{ description: 'Past purchase', amount: 400, date: '2026-10-05' }],
      }),
    );

    expect(result.totalPlannedExpenses).toBe(0);
    expect(result.projectionData[0]).toEqual({ month: '2026-11', balance: 900 });
  });
});

describe('affordability', () => {
  const baseInput = {
    currencyCode: 'GBP',
    purchaseAmount: 100,
    currentBalance: 1000,
    monthlyIncome: 1000,
    monthlyExpenses: 500,
    reserveTarget: 1500,
  };

  it('returns remaining cash and a reserve shortfall without a verdict', () => {
    const result = calculateAffordability(baseInput);

    expect(result).toMatchObject({
      currencyCode: 'GBP',
      balanceAfterPurchase: 900,
      reserveTarget: 1500,
      reserveShortfall: 600,
      monthlySurplus: 500,
      monthsUntilDepletion: null,
      explanation: 'Remaining cash is below the GBP reserve target.',
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(result).not.toHaveProperty('verdict');
  });

  it('reports no depletion when cash flow is zero or positive', () => {
    for (const monthlyIncome of [500, 1000]) {
      expect(
        calculateAffordability({ ...baseInput, monthlyIncome }).monthsUntilDepletion,
      ).toBeNull();
    }
  });

  it('calculates depletion only when expenses exceed income', () => {
    expect(calculateAffordability({ ...baseInput, monthlyIncome: 400 }).monthsUntilDepletion).toBe(
      9,
    );
  });

  it('reports zero months until depletion when a purchase leaves no cash and there is a deficit', () => {
    const result = calculateAffordability({
      ...baseInput,
      purchaseAmount: 1000,
      monthlyIncome: 400,
      reserveTarget: null,
    });

    expect(result.monthsUntilDepletion).toBe(0);
    expect(result.reserveShortfall).toBeNull();
    expect(result.explanation).toBe('Reserve comparison is turned off.');
  });

  it('does not report depletion or a false deficit reason at zero balance with positive cash flow', () => {
    const result = calculateAffordability({
      ...baseInput,
      purchaseAmount: 1000,
      monthlyIncome: 1000,
      monthlyExpenses: 500,
    });

    expect(result.balanceAfterPurchase).toBe(0);
    expect(result.monthsUntilDepletion).toBeNull();
    expect(result.monthlySurplus).toBe(500);
  });

  it('validates ISO currency and reserve inputs', () => {
    expect(() =>
      affordabilityCheckInputSchema.parse({ ...baseInput, currencyCode: 'usd' }),
    ).toThrow();
    expect(() =>
      affordabilityCheckInputSchema.parse({ ...baseInput, reserveTarget: -1 }),
    ).toThrow();
  });
});
