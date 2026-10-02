import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '../auth/types';

const mocks = vi.hoisted(() => {
  const auth: AuthContext = {
    user: {
      id: 'user-1',
      email: 'user-1@example.com',
      name: 'User One',
      emailVerified: true,
      image: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    userId: 'user-1',
    credential: 'mcp-oauth',
    scopes: ['career:read'],
  };
  return { checkRateLimit: vi.fn(), auth };
});

vi.mock('./rate-limiter', () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock('../env', async () => {
  const actual = await vi.importActual<typeof import('../env')>('../env');
  return { ...actual, env: { ...actual.env, NODE_ENV: 'production' } };
});
vi.mock('@better-auth/mcp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@better-auth/mcp')>()),
  requireMcpAuth:
    (
      _auth: unknown,
      handler: (request: Request, claims: Record<string, string>) => Promise<Response>,
    ) =>
    (request: Request) =>
      handler(request, { sub: 'user-1', scope: 'career:read', client_id: 'test' }),
}));
vi.mock('../middleware/auth', () => ({
  setMcpAuthContext: async (c: { set: (key: 'auth', value: AuthContext) => void }) => {
    c.set('auth', mocks.auth);
    return true;
  },
}));

import { mcpAuthorizationMiddleware } from './routes';
import type { McpHonoEnv } from './server';

const { auth } = mocks;

function createApp() {
  const app = new Hono<McpHonoEnv>();
  app.use('*', async (c, next) => {
    c.set('auth', auth);
    return mcpAuthorizationMiddleware(c, next);
  });
  app.get('*', (c) => c.json({ ok: true }));
  return app;
}

describe('MCP rate-limit route behavior', () => {
  beforeEach(() => {
    mocks.checkRateLimit.mockReset();
  });

  it('fails closed with 503 when Redis is unavailable', async () => {
    mocks.checkRateLimit.mockResolvedValue('unavailable');
    const app = createApp();
    const response = await app.request('/api/mcp');

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    await expect(response.json()).resolves.toMatchObject({
      error: 'rate_limit_unavailable',
    });
  });

  it('preserves 429 when the MCP quota is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValue('limited');
    const app = createApp();
    const response = await app.request('/api/mcp');

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: 'rate_limited' });
  });
});
