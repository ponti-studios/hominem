import { describe, expect, it } from 'vitest';

import { calculateAffordability, runwayScenarioInputSchema, simulateRunway } from './calculations';

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
});

describe('affordability', () => {
  it('returns a JSON-safe unbounded runway for zero or positive surplus', () => {
    const result = calculateAffordability({
      purchaseAmount: 100,
      currentBalance: 1000,
      monthlyIncome: 1000,
      monthlyExpenses: 0,
    });

    expect(result.monthsOfRunwayAfterPurchase).toBeNull();
    expect(result.percentOfMonthlyIncome).toBe(10);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('reports zero runway after a purchase depletes the balance', () => {
    const result = calculateAffordability({
      purchaseAmount: 1200,
      currentBalance: 1000,
      monthlyIncome: 0,
      monthlyExpenses: 500,
    });

    expect(result.monthsOfRunwayAfterPurchase).toBe(0);
  });
});
