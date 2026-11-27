import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FINANCE_ROUTE_USER_ID, financeTestApp } from '../../testkit/fixtures/finance-rpc';

const financeService = vi.hoisted(() => ({ searchTransactions: vi.fn() }));
vi.mock('../../application/finance.service', () => financeService);

import { transactionsRoutes } from './finance.transactions';

const createApp = () => financeTestApp('transactions', transactionsRoutes);

describe('finance transaction search route', () => {
  beforeEach(() => financeService.searchTransactions.mockReset());

  it('passes fuzzy text to the search service and retains its bounded result count', async () => {
    financeService.searchTransactions.mockResolvedValue({
      data: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          userId: FINANCE_ROUTE_USER_ID,
          accountId: '33333333-3333-4333-8333-333333333333',
          amount: -4.5,
          description: 'Parking Garage',
          merchantName: 'Parking Garage',
          postedOn: '2026-10-12',
          currencyCode: 'GBP',
        },
      ],
      filteredCount: 1,
      totalUserCount: 1000,
      nextCursor: null,
    });

    const response = await createApp().request('/api/finance/transactions/list?description=parkin');

    expect(response.status).toBe(200);
    expect(financeService.searchTransactions).toHaveBeenCalledWith(FINANCE_ROUTE_USER_ID, {
      accountIds: [],
      dateFrom: undefined,
      dateTo: undefined,
      text: 'parkin',
      tagIds: undefined,
      tagNames: undefined,
      limit: 20,
      cursor: undefined,
    });
    await expect(response.json()).resolves.toMatchObject({
      data: [{ currencyCode: 'GBP' }],
      filteredCount: 1,
      totalUserCount: 1000,
      nextCursor: null,
    });
  });

  it('passes an exact amount query to the search service', async () => {
    financeService.searchTransactions.mockResolvedValue({
      data: [],
      filteredCount: 0,
      totalUserCount: 1000,
      nextCursor: null,
    });

    const response = await createApp().request(
      '/api/finance/transactions/list?min=225.7&max=225.7&limit=8',
    );

    expect(response.status).toBe(200);
    expect(financeService.searchTransactions).toHaveBeenCalledWith(FINANCE_ROUTE_USER_ID, {
      accountIds: [],
      dateFrom: undefined,
      dateTo: undefined,
      text: undefined,
      tagIds: undefined,
      tagNames: undefined,
      amountMin: 225.7,
      amountMax: 225.7,
      limit: 8,
      cursor: undefined,
    });
  });

  it('forwards the cursor and returns the next one', async () => {
    financeService.searchTransactions.mockResolvedValue({
      data: [],
      filteredCount: 4,
      totalUserCount: 1000,
      nextCursor: 'next-page-cursor',
    });

    const response = await createApp().request('/api/finance/transactions/list?limit=2&cursor=abc');

    expect(response.status).toBe(200);
    expect(financeService.searchTransactions).toHaveBeenCalledWith(
      FINANCE_ROUTE_USER_ID,
      expect.objectContaining({ limit: 2, cursor: 'abc' }),
    );
    await expect(response.json()).resolves.toMatchObject({ nextCursor: 'next-page-cursor' });
  });

  it('rejects limits above 50 and ignores a retired offset parameter', async () => {
    financeService.searchTransactions.mockResolvedValue({
      data: [],
      filteredCount: 0,
      totalUserCount: 0,
      nextCursor: null,
    });

    expect((await createApp().request('/api/finance/transactions/list?limit=51')).status).toBe(400);

    const response = await createApp().request('/api/finance/transactions/list?offset=100');
    expect(response.status).toBe(200);
    expect(financeService.searchTransactions).toHaveBeenCalledWith(
      FINANCE_ROUTE_USER_ID,
      expect.not.objectContaining({ offset: expect.anything() }),
    );
  });
});
