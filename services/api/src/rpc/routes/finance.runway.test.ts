import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

const testUserId = '11111111-1111-4111-8111-111111111111';
const contextFixture = {
  asOfDate: '2026-11-11',
  currencyCode: 'GBP',
  availableCurrencies: ['GBP', 'USD'],
  liquidAccounts: [{ accountName: 'Checking', balance: 1000 }],
  startingCash: 1000,
  monthlyIncome: 500,
  monthlyExpenses: 400,
  historyStartDate: '2026-05-01',
  historyEndDate: '2026-10-31',
  historyMonthCount: 6,
  transactionCount: 12,
  warnings: ['Only GBP is included. Other currencies excluded: USD.'],
};

vi.mock('@hominem/finance-services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hominem/finance-services')>();
  return { ...actual, getAffordabilityContext: vi.fn() };
});

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (
    context: { set: (key: string, value: unknown) => void },
    next: () => Promise<void>,
  ) => {
    context.set('auth', {
      userId: testUserId,
      user: { id: testUserId },
    });
    await next();
  },
}));

import { getAffordabilityContext } from '@hominem/finance-services';

import type { AppContext } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { affordabilityRoutes } from './finance.affordability';
import { runwayRoutes } from './finance.runway';

const app = new Hono<AppContext>()
  .onError(apiErrorHandler)
  .route('/runway', runwayRoutes)
  .route('/affordability', affordabilityRoutes);

describe('finance forecast routes', () => {
  it('returns the authenticated user context for the existing Finance currency', async () => {
    vi.mocked(getAffordabilityContext).mockResolvedValue(contextFixture);

    const response = await app.request('/affordability/context');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      currencyCode: 'GBP',
      startingCash: 1000,
      historyStartDate: '2026-05-01',
      historyEndDate: '2026-10-31',
    });
    expect(getAffordabilityContext).toHaveBeenCalledWith(testUserId);
  });

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

  it('uses Finance balances and defaults the reserve to three monthly expenses', async () => {
    vi.mocked(getAffordabilityContext).mockResolvedValue(contextFixture);
    const response = await app.request('/affordability/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        purchaseAmount: 100,
      }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      currencyCode: 'GBP',
      balanceAfterPurchase: 900,
      reserveTarget: 1200,
      reserveShortfall: 300,
      monthlySurplus: 100,
      monthsUntilDepletion: null,
      balanceSource: 'finance',
      monthlyIncomeSource: 'finance',
      monthlyExpensesSource: 'finance',
    });
  });

  it('uses explicit temporary overrides without changing the Finance context', async () => {
    vi.mocked(getAffordabilityContext).mockResolvedValue({
      ...contextFixture,
      startingCash: null,
      monthlyIncome: null,
      monthlyExpenses: null,
    });
    const response = await app.request('/affordability/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        purchaseAmount: 100,
        cashBalanceOverride: 700,
        monthlyIncomeOverride: 1000,
        monthlyExpensesOverride: 300,
        reserveTarget: null,
      }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      balanceAfterPurchase: 600,
      reserveTarget: null,
      reserveShortfall: null,
      monthlySurplus: 700,
      balanceSource: 'manual',
      monthlyIncomeSource: 'manual',
      monthlyExpensesSource: 'manual',
    });
  });

  it('requires a saved Finance currency and validates temporary amounts', async () => {
    vi.mocked(getAffordabilityContext).mockResolvedValue({
      ...contextFixture,
      currencyCode: null,
      startingCash: null,
    });
    const missingCurrency = await app.request('/affordability/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ purchaseAmount: 100 }),
    });
    expect(missingCurrency.status).toBeGreaterThanOrEqual(400);

    vi.mocked(getAffordabilityContext).mockResolvedValue(contextFixture);
    const invalid = await app.request('/affordability/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ purchaseAmount: 100, monthlyIncomeOverride: 'Infinity' }),
    });
    expect(invalid.status).toBe(400);

    vi.mocked(getAffordabilityContext).mockResolvedValue({
      ...contextFixture,
      startingCash: null,
      monthlyIncome: null,
      monthlyExpenses: null,
    });
    const missingSources = await app.request('/affordability/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ purchaseAmount: 100 }),
    });
    expect(missingSources.status).toBeGreaterThanOrEqual(400);

    vi.mocked(getAffordabilityContext).mockResolvedValue(contextFixture);
    const unauthorizedBalanceOverride = await app.request('/affordability/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ purchaseAmount: 100, cashBalanceOverride: 700 }),
    });
    expect(unauthorizedBalanceOverride.status).toBeGreaterThanOrEqual(400);
  });
});
