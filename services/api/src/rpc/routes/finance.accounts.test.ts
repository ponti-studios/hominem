import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppContext, RpcUser } from '../middleware/auth';
import { requestIdMiddleware } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { validationErrorMiddleware } from '../middleware/validation';

const accountService = vi.hoisted(() => ({ getFinanceAccountList: vi.fn() }));
const database = vi.hoisted(() => ({ selectFrom: vi.fn() }));

vi.mock('@hominem/finance-services', () => accountService);
vi.mock('@hominem/db/core', () => ({ db: database }));

import { accountsRoutes } from './finance.accounts';

const testUser: RpcUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'finance-accounts@example.com',
  name: 'Finance Accounts Test User',
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

  return app.route('/api/finance/accounts', accountsRoutes);
}

describe('finance account routes', () => {
  beforeEach(() => accountService.getFinanceAccountList.mockReset());

  it('returns account data without Plaid connection state', async () => {
    const query = {
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
    };
    database.selectFrom.mockReturnValue(query);

    const response = await createApp().request('/api/finance/accounts/all');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ accounts: [] });
    expect(database.selectFrom).not.toHaveBeenCalledWith('app.plaidItems');
  });

  it('returns the MCP account-list object for the authenticated owner', async () => {
    const result = {
      accounts: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Everyday Checking',
          accountType: 'checking',
          currencyCode: 'USD',
          allowedCurrencies: ['USD', 'GBP'],
          lifecycleStatus: 'open',
          includeInNetWorth: true,
          balanceCents: 12345,
        },
      ],
      count: 1,
      totalCount: 1,
    };
    accountService.getFinanceAccountList.mockResolvedValue(result);

    const response = await createApp().request('/api/finance/accounts/list');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(result);
    expect(accountService.getFinanceAccountList).toHaveBeenCalledWith(testUser.id, {
      includeClosed: false,
    });
  });

  it('passes the includeClosed filter to the shared account service', async () => {
    accountService.getFinanceAccountList.mockResolvedValue({
      accounts: [],
      count: 0,
      totalCount: 0,
    });

    const response = await createApp().request('/api/finance/accounts/list?includeClosed=true');

    expect(response.status).toBe(200);
    expect(accountService.getFinanceAccountList).toHaveBeenCalledWith(testUser.id, {
      includeClosed: true,
    });
  });

  it('returns all accounts when the shared service reports more than 50', async () => {
    const accounts = Array.from({ length: 51 }, (_, index) => ({
      id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`,
      name: `Account ${index + 1}`,
      accountType: 'checking',
      currencyCode: 'USD',
      allowedCurrencies: ['USD'],
      lifecycleStatus: 'open',
      includeInNetWorth: true,
      balanceCents: 0,
    }));
    accountService.getFinanceAccountList.mockResolvedValue({
      accounts,
      count: accounts.length,
      totalCount: accounts.length,
    });

    const response = await createApp().request('/api/finance/accounts/list');

    expect(response.status).toBe(200);
    const body: { accounts: unknown[]; count: number } = await response.json();
    expect(body.accounts).toHaveLength(51);
    expect(body.count).toBe(51);
  });
});
