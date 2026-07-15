import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { authMiddleware } from './auth';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'auth@example.com',
  emailVerified: true,
  name: 'Auth Test User',
  image: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createApp() {
  const app = new Hono().use('*', authMiddleware()).get('*', (c) => c.json(c.get('auth') ?? null));

  return app;
}

describe('auth middleware', () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.getMcpSession.mockReset();
    mocks.executeTakeFirst.mockReset();
    mocks.executeTakeFirst.mockResolvedValue(user);
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('resolves a normal Better Auth session into the canonical context', async () => {
    mocks.getSession.mockResolvedValue({
      user,
      session: { id: 'session-123' },
    });

    const response = await createApp().request('/api/mcp', {
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
    vi.stubEnv('NODE_ENV', 'production');
    mocks.getSession.mockResolvedValue({
      user,
      session: { id: 'session-123' },
    });

    const response = await createApp().request('/api/mcp', {
      headers: { 'x-mcp-scopes': 'career:read' },
    });
    const auth = (await response.json()) as AuthContext;

    expect(auth).toMatchObject({ credential: 'session', scopes: [] });
  });

  it('resolves MCP OAuth without performing a second normal session lookup', async () => {
    mocks.getMcpSession.mockResolvedValue({ userId: user.id, scopes: 'career:read' });

    const response = await createApp().request('/api/mcp', {
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

    const response = await createApp().request('/api/mcp', {
      headers: { authorization: 'Bearer better-auth-session-token' },
    });
    const auth = (await response.json()) as AuthContext;

    expect(auth.credential).toBe('session');
    expect(mocks.getSession).toHaveBeenCalledOnce();
  });

  it('allows E2E identity only with the configured secret', async () => {
    vi.stubEnv('AUTH_E2E_ENABLED', 'true');
    vi.stubEnv('AUTH_E2E_SECRET', 'test-secret');

    const response = await createApp().request('/api/mcp', {
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

  it('rejects E2E identity when the secret is missing or invalid', async () => {
    vi.stubEnv('AUTH_E2E_ENABLED', 'true');
    vi.stubEnv('AUTH_E2E_SECRET', 'test-secret');

    const response = await createApp().request('/api/mcp', {
      headers: {
        'x-user-id': user.id,
        'x-e2e-auth-secret': 'wrong-secret',
      },
    });

    expect(await response.json()).toBeNull();
  });

  it('rejects E2E identity in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_E2E_ENABLED', 'true');
    vi.stubEnv('AUTH_E2E_SECRET', 'test-secret');

    const response = await createApp().request('/api/mcp', {
      headers: {
        'x-user-id': user.id,
        'x-e2e-auth-secret': 'test-secret',
      },
    });

    expect(await response.json()).toBeNull();
  });
});
