import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ inviteToThames: vi.fn() }));
vi.mock('../../application/thames-invite', () => ({ inviteToThames: mocks.inviteToThames }));
vi.mock('../../auth/better-auth', () => ({ sendEmail: vi.fn() }));
vi.mock('../../application/provider-credentials.store', () => ({
  dbCredentialStore: { isAllowed: vi.fn() },
}));
vi.mock('../../env', () => ({ env: {} }));

import { createRpcTestApp, postJson } from '../../testkit/rpc-test-app';
import { invitesRoutes } from './invites';

const app = createRpcTestApp(invitesRoutes, {
  authenticated: false,
  path: '/api/invites',
  user: {} as never,
});

beforeEach(() => vi.clearAllMocks());

describe('POST /api/invites/thames', () => {
  it('answers 202 whatever the outcome, so domains are not revealed', async () => {
    for (const outcome of ['sent', 'not_listed', 'rate_limited', 'unavailable']) {
      mocks.inviteToThames.mockResolvedValueOnce(outcome);
      const res = await postJson(app, '/api/invites/thames', { email: 'dana@work.com' });
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({ ok: true });
    }
  });

  it('answers 202 even when sending throws', async () => {
    mocks.inviteToThames.mockRejectedValueOnce(new Error('resend down'));
    const res = await postJson(app, '/api/invites/thames', { email: 'dana@work.com' });
    expect(res.status).toBe(202);
  });

  it('rejects something that is not an email', async () => {
    const res = await postJson(app, '/api/invites/thames', { email: 'nope' });
    expect(res.status).toBe(400);
    expect(mocks.inviteToThames).not.toHaveBeenCalled();
  });
});
