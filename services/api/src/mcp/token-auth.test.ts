import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveMcpToken } from '../application/mcp-tokens.service';
import type { AuthContext } from '../auth/types';
import type { AppContext, RpcUser } from '../rpc/middleware/auth';
import { requestIdMiddleware } from '../rpc/middleware/auth';
import { apiErrorHandler } from '../rpc/middleware/error';
import { validationErrorMiddleware } from '../rpc/middleware/validation';
import { MCP_SCOPES } from '../scopes';
import { mcpRoutes } from './routes';

vi.mock('@better-auth/mcp', async (importOriginal) => ({
  // The token path must never reach the OAuth flow — if requireMcpAuth runs,
  // this spy fails the test loudly instead of silently accepting.
  ...(await importOriginal<typeof import('@better-auth/mcp')>()),
  requireMcpAuth: vi.fn().mockImplementation(() => {
    throw new Error('requireMcpAuth must not run for an hmt_ bearer token');
  }),
}));

vi.mock('../application/mcp-tokens.service', () => ({
  MCP_TOKEN_PREFIX: 'hmt_',
  resolveMcpToken: vi.fn(),
}));

const captured: {
  claims: Record<string, unknown> | null;
  credential: string | null;
  set: boolean;
} = {
  claims: null,
  credential: null,
  set: false,
};

vi.mock('../middleware/auth', () => ({
  setMcpAuthContext: async (
    c: { set: (key: 'auth', value: AuthContext) => void },
    claims: Record<string, unknown>,
    credential?: 'mcp-oauth' | 'mcp-token',
  ) => {
    captured.claims = claims;
    captured.credential = credential ?? 'mcp-oauth';
    captured.set = true;
    c.set('auth', {
      user: testUser,
      userId: testUser.id,
      clientId: typeof claims.client_id === 'string' ? claims.client_id : undefined,
      credential: credential ?? 'mcp-oauth',
      scopes: typeof claims.scope === 'string' ? claims.scope.split(' ') : [],
    });
    return true;
  },
}));

const testUser: RpcUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'token-mcp@example.com',
  name: 'Token MCP Test User',
  emailVerified: true,
  image: null,
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createApp() {
  return new Hono<AppContext>()
    .onError(apiErrorHandler)
    .use(requestIdMiddleware)
    .use(validationErrorMiddleware)
    .basePath('/api')
    .route('/mcp', mcpRoutes);
}

function tokenRequest(token: string) {
  return new Request('http://localhost/api/mcp', {
    headers: { authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  vi.mocked(resolveMcpToken).mockReset();
  captured.claims = null;
  captured.credential = null;
  captured.set = false;
});

describe('mcp bearer token auth', () => {
  it('resolves an hmt_ token to the owner with all scopes when token scopes are empty', async () => {
    vi.mocked(resolveMcpToken).mockResolvedValue({
      ownerUserId: testUser.id,
      scopes: [],
    });

    const response = await createApp().fetch(tokenRequest('hmt_valid_token_value'));

    expect(resolveMcpToken).toHaveBeenCalledWith('hmt_valid_token_value');
    expect(captured.set).toBe(true);
    expect(captured.credential).toBe('mcp-token');
    expect(captured.claims).toMatchObject({
      sub: testUser.id,
      client_id: 'hominem-mcp-token',
    });
    const scope =
      typeof captured.claims?.scope === 'string' ? captured.claims.scope.split(' ') : [];
    expect(scope).toEqual([...MCP_SCOPES]);
    expect(response.status).not.toBe(401);
  });

  it('restricts a scoped token to its own scope allow-list', async () => {
    vi.mocked(resolveMcpToken).mockResolvedValue({
      ownerUserId: testUser.id,
      scopes: ['career:read'],
    });

    const response = await createApp().fetch(tokenRequest('hmt_scoped_token_value'));

    expect(captured.claims?.scope).toBe('career:read');
    expect(response.status).not.toBe(401);
  });

  it('rejects an unknown or revoked hmt_ token with 401', async () => {
    vi.mocked(resolveMcpToken).mockResolvedValue(null);

    const response = await createApp().fetch(tokenRequest('hmt_unknown_token_value'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_token' });
  });
});
