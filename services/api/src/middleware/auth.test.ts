import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getMcpSession: vi.fn(),
  executeTakeFirst: vi.fn(),
}));

vi.mock('@hominem/db', () => ({
  authDb: {
    selectFrom: vi.fn(() => ({
      selectAll: vi.fn(() => ({
        where: vi.fn(() => ({ executeTakeFirst: mocks.executeTakeFirst })),
      })),
    })),
  },
}));

vi.mock('../auth/better-auth', () => ({
  MCP_SCOPES: ['career:read'],
  betterAuthServer: { api: { getSession: mocks.getSession } },
  betterAuthMcpServer: { api: { getMcpSession: mocks.getMcpSession } },
}));

import type { AuthContext } from '../auth/types';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'auth@example.com',
  emailVerified: true,
  name: 'Auth Test User',
  image: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// The auth middleware reads env fields once at import time (validated,
// process-wide config), so vi.stubEnv after import has no effect. Re-mock
// the ../env module and re-import fresh per test to exercise different
// NODE_ENV / AUTH_E2E_* combinations.
async function createApp(envOverrides: Record<string, string | boolean> = {}) {
  vi.resetModules();
  vi.doMock('../env', async () => {
    const actual = await vi.importActual<typeof import('../env')>('../env');
    return { env: { ...actual.env, ...envOverrides } };
  });

  const { authMiddleware } = await import('./auth');

  return new Hono().use('*', authMiddleware()).get('*', (c) => c.json(c.get('auth') ?? null));
}

describe('auth middleware', () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.getMcpSession.mockReset();
    mocks.executeTakeFirst.mockReset();
    mocks.executeTakeFirst.mockResolvedValue(user);
  });

  it('resolves a normal Better Auth session into the canonical context', async () => {
    mocks.getSession.mockResolvedValue({
      user,
      session: { id: 'session-123' },
    });

    const app = await createApp();
    const response = await app.request('/api/mcp', {
      headers: { 'x-mcp-scopes': 'admin:write' },
    });
    const auth = (await response.json()) as AuthContext;

    expect(auth).toMatchObject({
      userId: user.id,
      sessionId: 'session-123',
      credential: 'session',
      scopes: ['career:read'],
    });
    expect(mocks.getMcpSession).not.toHaveBeenCalled();
  });

  it('does not grant implicit MCP scopes to a production session', async () => {
    mocks.getSession.mockResolvedValue({
      user,
      session: { id: 'session-123' },
    });

    const app = await createApp({ NODE_ENV: 'production' });
    const response = await app.request('/api/mcp', {
      headers: { 'x-mcp-scopes': 'career:read' },
    });
    const auth = (await response.json()) as AuthContext;

    expect(auth).toMatchObject({ credential: 'session', scopes: [] });
  });

  it('resolves MCP OAuth without performing a second normal session lookup', async () => {
    mocks.getMcpSession.mockResolvedValue({ userId: user.id, scopes: 'career:read' });

    const app = await createApp();
    const response = await app.request('/api/mcp', {
      headers: {
        authorization: 'Bearer mcp-token',
        'x-mcp-scopes': 'admin:write',
      },
    });
    const auth = (await response.json()) as AuthContext;

    expect(auth).toMatchObject({
      userId: user.id,
      credential: 'mcp-oauth',
      scopes: ['career:read'],
    });
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it('keeps Better Auth bearer-session fallback for now', async () => {
    mocks.getMcpSession.mockResolvedValue(null);
    mocks.getSession.mockResolvedValue({
      user,
      session: { id: 'session-123' },
    });

    const app = await createApp();
    const response = await app.request('/api/mcp', {
      headers: { authorization: 'Bearer better-auth-session-token' },
    });
    const auth = (await response.json()) as AuthContext;

    expect(auth.credential).toBe('session');
    expect(mocks.getSession).toHaveBeenCalledOnce();
  });

  it('allows E2E identity only with the configured secret', async () => {
    const app = await createApp({ AUTH_E2E_ENABLED: true, AUTH_E2E_SECRET: 'test-secret' });

    const response = await app.request('/api/mcp', {
      headers: {
        'x-user-id': user.id,
        'x-e2e-auth-secret': 'test-secret',
        'x-mcp-scopes': 'career:read',
      },
    });
    const auth = (await response.json()) as AuthContext;

    expect(auth).toMatchObject({
      userId: user.id,
      credential: 'e2e',
      scopes: ['career:read'],
    });
    expect(mocks.getSession).toHaveBeenCalledOnce();
  });

  it('prefers the persisted user row over the fabricated placeholder for E2E identity', async () => {
    const app = await createApp({ AUTH_E2E_ENABLED: true, AUTH_E2E_SECRET: 'test-secret' });

    const response = await app.request('/api/mcp', {
      headers: {
        'x-user-id': user.id,
        'x-e2e-auth-secret': 'test-secret',
      },
    });
    const auth = (await response.json()) as AuthContext;

    expect(auth?.user).toMatchObject(user);
  });

  it('falls back to a placeholder user when no row exists yet for the proxied id', async () => {
    mocks.executeTakeFirst.mockResolvedValue(undefined);
    const app = await createApp({ AUTH_E2E_ENABLED: true, AUTH_E2E_SECRET: 'test-secret' });

    const response = await app.request('/api/mcp', {
      headers: {
        'x-user-id': user.id,
        'x-e2e-auth-secret': 'test-secret',
      },
    });
    const auth = (await response.json()) as AuthContext;

    expect(auth?.user?.email).toBe(`proxy-${user.id.slice(0, 8)}@hominem.e2e`);
  });

  it('rejects E2E identity when the secret is missing or invalid', async () => {
    const app = await createApp({ AUTH_E2E_ENABLED: true, AUTH_E2E_SECRET: 'test-secret' });

    const response = await app.request('/api/mcp', {
      headers: {
        'x-user-id': user.id,
        'x-e2e-auth-secret': 'wrong-secret',
      },
    });

    expect(await response.json()).toBeNull();
  });

  it('rejects E2E identity in production', async () => {
    const app = await createApp({
      NODE_ENV: 'production',
      AUTH_E2E_ENABLED: true,
      AUTH_E2E_SECRET: 'test-secret',
    });

    const response = await app.request('/api/mcp', {
      headers: {
        'x-user-id': user.id,
        'x-e2e-auth-secret': 'test-secret',
      },
    });

    expect(await response.json()).toBeNull();
  });
});
