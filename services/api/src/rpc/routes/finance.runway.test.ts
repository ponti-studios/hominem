import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (
    context: { set: (key: string, value: unknown) => void },
    next: () => Promise<void>,
  ) => {
    context.set('auth', {
      userId: '11111111-1111-4111-8111-111111111111',
      user: { id: '11111111-1111-4111-8111-111111111111' },
    });
    await next();
  },
}));

import { affordabilityRoutes } from './finance.affordability';
import { runwayRoutes } from './finance.runway';

const app = new Hono().route('/runway', runwayRoutes).route('/affordability', affordabilityRoutes);

describe('finance forecast routes', () => {
  it('accepts JSON scenario inputs and applies planned purchases to depletion', async () => {
    const response = await app.request('/runway/calculate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        balance: 1000,
        monthlyExpenses: 200,
        projectionMonths: 12,
        asOf: '2026-01-31',
        plannedPurchases: [{ description: 'Trip', amount: 300, date: '2026-02-01' }],
      }),
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.runwayMonths).toBe(4);
    expect(result.projectionData[0].balance).toBe(500);
    expect(result.runwayEndDate).toBe('2026-05-01T00:00:00.000Z');
  });

  it.each([
    { balance: 1, monthlyExpenses: Number.NaN, plannedPurchases: [] },
    {
      balance: 1,
      monthlyExpenses: 1,
      plannedPurchases: [{ description: 'x', amount: 1, date: '2026-02-30' }],
    },
  ])('rejects invalid scenario values', async (body) => {
    const response = await app.request('/runway/calculate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(400);
  });

  it('serializes an unbounded affordability runway as null', async () => {
    const response = await app.request('/affordability/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        purchaseAmount: 100,
        currentBalance: 1000,
        monthlyIncome: 1000,
        monthlyExpenses: 0,
      }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      monthsOfRunwayAfterPurchase: null,
      percentOfMonthlyIncome: 10,
    });
  });

  it('rejects non-finite affordability inputs', async () => {
    const response = await app.request('/affordability/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        purchaseAmount: 100,
        currentBalance: 1000,
        monthlyIncome: 'Infinity',
        monthlyExpenses: 0,
      }),
    });
    expect(response.status).toBe(400);
  });
});
