import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppContext, RpcUser } from '../middleware/auth';
import { requestIdMiddleware } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { validationErrorMiddleware } from '../middleware/validation';

const financeService = vi.hoisted(() => ({ searchTransactions: vi.fn() }));
vi.mock('../../application/finance.service', () => financeService);

import { transactionsRoutes } from './finance.transactions';

const testUser: RpcUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'finance-search@example.com',
  name: 'Finance Search Test User',
  emailVerified: true,
  image: null,
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createApp() {
  const app = new Hono<AppContext>()
    .onError(apiErrorHandler)
    .use(requestIdMiddleware)
    .use(validationErrorMiddleware)
    .use('*', async (c, next) => {
      c.set('auth', {
        user: testUser,
        userId: testUser.id,
        credential: 'session',
        scopes: [],
      });
      await next();
    });

  return app.route('/api/finance/transactions', transactionsRoutes);
}

describe('finance transaction search route', () => {
  beforeEach(() => financeService.searchTransactions.mockReset());

  it('passes fuzzy text to the search service and retains its bounded result count', async () => {
    financeService.searchTransactions.mockResolvedValue({
      data: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          userId: testUser.id,
          accountId: '33333333-3333-4333-8333-333333333333',
          amount: -4.5,
          description: 'Parking Garage',
          merchantName: 'Parking Garage',
          postedOn: '2026-10-12',
        },
      ],
      filteredCount: 1,
      totalUserCount: 1000,
    });

    const response = await createApp().request(
      '/api/finance/transactions/list?description=parkin&limit=8&offset=0',
    );

    expect(response.status).toBe(200);
    expect(financeService.searchTransactions).toHaveBeenCalledWith(testUser.id, {
      accountIds: [],
      dateFrom: undefined,
      dateTo: undefined,
      text: 'parkin',
      tagIds: undefined,
      tagNames: undefined,
      limit: 8,
      offset: 0,
    });
    await expect(response.json()).resolves.toMatchObject({
      filteredCount: 1,
      totalUserCount: 1000,
    });
  });

  it('passes an exact amount query to the search service', async () => {
    financeService.searchTransactions.mockResolvedValue({
      data: [],
      filteredCount: 0,
      totalUserCount: 1000,
    });

    const response = await createApp().request(
      '/api/finance/transactions/list?min=225.7&max=225.7&limit=8&offset=0',
    );

    expect(response.status).toBe(200);
    expect(financeService.searchTransactions).toHaveBeenCalledWith(testUser.id, {
      accountIds: [],
      dateFrom: undefined,
      dateTo: undefined,
      text: undefined,
      tagIds: undefined,
      tagNames: undefined,
      amountMin: 225.7,
      amountMax: 225.7,
      limit: 8,
      offset: 0,
    });
  });
});
