import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const userId = '11111111-1111-4111-8111-111111111111';

vi.mock('../../application/finance.sync.service', () => ({
  financeSync: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../middleware/auth', () => ({
  authMiddleware: async (
    context: { set: (key: string, value: unknown) => void },
    next: () => Promise<void>,
  ) => {
    context.set('auth', { userId, user: { id: userId } });
    await next();
  },
}));

import { financeSync } from '../../application/finance.sync.service';
import type { AppContext } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { syncRoutes } from './finance.sync';

const app = new Hono<AppContext>().onError(apiErrorHandler).route('/sync', syncRoutes);
const windows = { starling_since: '2026-01-01', plaid_since: '2026-01-01', until: '2026-01-02' };

beforeEach(() => vi.clearAllMocks());

describe('finance sync RPC', () => {
  it('uses the authenticated owner and the shared sync service', async () => {
    const response = await app.request('/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ windows, dryRun: true }),
    });
    expect(response.status).toBe(200);
    expect(financeSync).toHaveBeenCalledWith(userId, {
      windows,
      dryRun: true,
      starling: [],
      linkTransfers: true,
    });
  });

  it('rejects a caller-supplied owner or reversed windows before calling the service', async () => {
    for (const body of [
      { windows, userId: 'other-user' },
      { windows: { ...windows, starling_since: '2026-01-03' } },
    ]) {
      const response = await app.request('/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(400);
    }
    expect(financeSync).not.toHaveBeenCalled();
  });
});
