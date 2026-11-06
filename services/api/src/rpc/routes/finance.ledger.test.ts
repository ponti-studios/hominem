import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  computeLedgerRunway: vi.fn(),
  findTransferPairs: vi.fn(),
  getAccountLedgerBreakdown: vi.fn(),
  getReconciliationStaleness: vi.fn(),
  getRunwaySettings: vi.fn(),
  getValidationGates: vi.fn(),
  postReconciliationAdjustment: vi.fn(),
}));

vi.mock('@hominem/finance-services', () => mocks);

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

import type { AppContext } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { ledgerRoutes } from './finance.ledger';

const app = new Hono<AppContext>().route('/ledger', ledgerRoutes).onError(apiErrorHandler);

const ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('finance ledger routes', () => {
  it('returns reconciliation staleness and validation gates together', async () => {
    mocks.getReconciliationStaleness.mockResolvedValue([{ accountId: ACCOUNT_ID }]);
    mocks.getValidationGates.mockResolvedValue({ totalTransactions: 12 });

    const response = await app.request('/ledger/reconcile');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      staleness: [{ accountId: ACCOUNT_ID }],
      gates: { totalTransactions: 12 },
    });
    expect(mocks.getReconciliationStaleness).toHaveBeenCalledWith(USER_ID);
    expect(mocks.getValidationGates).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 404 when the account is not owned by the caller', async () => {
    mocks.getAccountLedgerBreakdown.mockResolvedValue(null);

    const response = await app.request(`/ledger/accounts/${ACCOUNT_ID}`);

    expect(response.status).toBe(404);
  });

  it('returns the per-description ledger breakdown', async () => {
    mocks.getAccountLedgerBreakdown.mockResolvedValue({
      accountId: ACCOUNT_ID,
      accountName: 'Checking',
      balance: 100,
      rows: [],
    });

    const response = await app.request(`/ledger/accounts/${ACCOUNT_ID}`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      accountId: ACCOUNT_ID,
      accountName: 'Checking',
      balance: 100,
    });
    expect(mocks.getAccountLedgerBreakdown).toHaveBeenCalledWith(USER_ID, ACCOUNT_ID);
  });

  it('posts a reconcile adjustment scoped to the caller', async () => {
    mocks.postReconciliationAdjustment.mockResolvedValue({
      accountId: ACCOUNT_ID,
      plug: 25,
      committed: true,
    });

    const response = await app.request('/ledger/adjustment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accountId: ACCOUNT_ID, targetBalance: 125, note: 'True up' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ plug: 25, committed: true });
    expect(mocks.postReconciliationAdjustment).toHaveBeenCalledWith({
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      targetBalance: 125,
      note: 'True up',
    });
  });

  it('rejects an adjustment with a non-finite target balance', async () => {
    const response = await app.request('/ledger/adjustment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accountId: ACCOUNT_ID, targetBalance: 'Infinity' }),
    });

    expect(response.status).toBe(400);
    expect(mocks.postReconciliationAdjustment).not.toHaveBeenCalled();
  });

  it('coerces transfer filters and scopes them to the caller', async () => {
    mocks.findTransferPairs.mockResolvedValue([]);

    const response = await app.request('/ledger/transfers?windowDays=3&minAmount=250&limit=10');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ pairs: [] });
    expect(mocks.findTransferPairs).toHaveBeenCalledWith({
      userId: USER_ID,
      windowDays: 3,
      minAmount: 250,
      limit: 10,
    });
  });

  it('derives runway from the stored settings and current ledger', async () => {
    mocks.getRunwaySettings.mockResolvedValue({
      currencyCode: 'USD',
      currencies: ['USD'],
      categories: [],
      budgets: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          categoryId: '44444444-4444-4444-8444-444444444444',
          category: 'Groceries',
          currencyCode: 'USD',
          amount: 400,
        },
      ],
    });
    mocks.computeLedgerRunway.mockResolvedValue({ weeks: [], startingCash: 1000 });

    const response = await app.request('/ledger/runway');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ runway: { startingCash: 1000 } });
    expect(mocks.computeLedgerRunway).toHaveBeenCalledWith({
      userId: USER_ID,
      currencyCode: 'USD',
      monthlyBudgets: [{ category: 'Groceries', amount: 400, currencyCode: 'USD' }],
    });
  });
});
