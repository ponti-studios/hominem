import { authDb, db } from '@hominem/db/core';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { Hono } from 'hono';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveMcpToken } from '../application/mcp-tokens.service';
import type { AuthContext } from '../auth/types';
import { env } from '../env';
import type { AppContext, RpcUser } from '../rpc/middleware/auth';
import { requestIdMiddleware } from '../rpc/middleware/auth';
import { apiErrorHandler } from '../rpc/middleware/error';
import { validationErrorMiddleware } from '../rpc/middleware/validation';
import { MCP_SCOPES } from '../scopes';
import { mcpRoutes } from './routes';
import { listTools } from './tool-registry';

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

beforeAll(async () => {
  // Tool calls now record plan usage against a real user row; give the fixture identity one.
  await authDb
    .insertInto('user')
    .values({ id: testUser.id, name: testUser.name, email: testUser.email })
    .onConflict((oc) => oc.doNothing())
    .execute();
});

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

async function createClient(token: string) {
  const transport = new StreamableHTTPClientTransport(new URL('http://localhost/api/mcp'), {
    fetch: async (input, init) =>
      await createApp().fetch(
        new Request(input, {
          ...init,
          headers: {
            ...Object.fromEntries(new Headers(init?.headers)),
            authorization: `Bearer ${token}`,
          },
        }),
      ),
  });
  const client = new Client({ name: 'mcp-token-test', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

beforeEach(() => {
  vi.mocked(resolveMcpToken).mockReset();
  captured.claims = null;
  captured.credential = null;
  captured.set = false;
});

describe('mcp bearer token auth', () => {
  it('refuses travel_import to travel:read credentials without changing travel rows', async () => {
    vi.mocked(resolveMcpToken).mockResolvedValue({
      ownerUserId: testUser.id,
      scopes: ['travel:read'],
    });
    const countTravelIdeas = async () =>
      Number(
        (
          await db
            .selectFrom('app.travelIdeas')
            .select((eb) => eb.fn.countAll<number>().as('count'))
            .where('ownerUserid', '=', testUser.id)
            .executeTakeFirstOrThrow()
        ).count,
      );
    const before = await countTravelIdeas();
    const client = await createClient('hmt_travel_reader_token');

    try {
      const names = (await client.listTools()).tools.map((tool) => tool.name);
      expect(names).toContain('trip_history');
      expect(names).not.toContain('travel_import');
      await expect(
        client.callTool({
          name: 'travel_import',
          arguments: {
            rows: {
              ideas: [
                {
                  idea_id: 'IDA-DENIED',
                  idea: 'Must not exist',
                  type: 'experience',
                  status: 'open',
                },
              ],
            },
          },
        }),
      ).rejects.toThrow('Insufficient scope');
      expect(await countTravelIdeas()).toBe(before);
    } finally {
      await client.close();
    }
  });

  it('allows travel_import dry-run to a credential granted travel:write', async () => {
    vi.mocked(resolveMcpToken).mockResolvedValue({
      ownerUserId: testUser.id,
      scopes: ['travel:write'],
    });
    const client = await createClient('hmt_existing_travel_writer_token');

    try {
      const result = await client.callTool({
        name: 'travel_import',
        arguments: { rows: { ideas: [] }, dryRun: true },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ dryRun: true });
    } finally {
      await client.close();
    }
  });

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

  it('does not expose or allow calling tools outside a personal token scope allow-list', async () => {
    vi.mocked(resolveMcpToken).mockResolvedValue({
      ownerUserId: testUser.id,
      scopes: ['career:read'],
    });
    const client = await createClient('hmt_career_only_token');

    try {
      const tools = await client.listTools();
      const names = tools.tools.map((tool) => tool.name);

      expect(names).toContain('career_profile');
      expect(names).not.toContain('finance_net_worth');
      await expect(client.callTool({ name: 'finance_net_worth', arguments: {} })).rejects.toThrow(
        'Insufficient scope',
      );
    } finally {
      await client.close();
    }
  });

  it('answers a missing scope with a Bearer challenge that names the scope to request', async () => {
    vi.mocked(resolveMcpToken).mockResolvedValue({
      ownerUserId: testUser.id,
      scopes: ['career:read'],
    });

    const response = await createApp().request('/api/mcp', {
      method: 'POST',
      headers: {
        authorization: 'Bearer hmt_career_only_token',
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'finance_net_worth', arguments: {} },
      }),
    });

    const financeNetWorth = listTools().find((tool) => tool.name === 'finance_net_worth');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: 'insufficient_scope',
      required_scopes: financeNetWorth?.scopes,
    });
    const challenge = response.headers.get('www-authenticate') ?? '';
    expect(challenge).toContain('Bearer error="insufficient_scope"');
    expect(challenge).toContain(`scope="${(financeNetWorth?.scopes ?? []).join(' ')}"`);
    expect(challenge).toContain(
      `resource_metadata="${new URL('/.well-known/oauth-protected-resource/api/mcp', env.API_URL)}"`,
    );
  });

  it('enforces finance tool scopes for personal tokens at discovery and call time', async () => {
    const scopesByToken: Record<string, string[]> = {
      hmt_finance_read_token: ['finance:read'],
      hmt_finance_write_token: ['finance:write'],
      hmt_finance_full_write_token: ['finance:write', 'tags:write'],
    };
    vi.mocked(resolveMcpToken).mockImplementation(async (token) => {
      const scopes = scopesByToken[token];
      return scopes ? { ownerUserId: testUser.id, scopes } : null;
    });

    const financeTools = listTools().filter((tool) => tool.name.startsWith('finance_'));
    const readToolNames = financeTools.filter((tool) => tool.readOnly).map((tool) => tool.name);
    const writeToolNames = financeTools.filter((tool) => !tool.readOnly).map((tool) => tool.name);
    const financeReader = await createClient('hmt_finance_read_token');
    const financeWriter = await createClient('hmt_finance_write_token');
    const fullyScopedFinanceWriter = await createClient('hmt_finance_full_write_token');

    try {
      const readerTools = (await financeReader.listTools()).tools.map((tool) => tool.name);
      expect(readerTools.filter((name) => name.startsWith('finance_'))).toEqual(readToolNames);
      for (const toolName of writeToolNames) {
        await expect(financeReader.callTool({ name: toolName, arguments: {} })).rejects.toThrow(
          'Insufficient scope',
        );
      }

      const writerTools = (await financeWriter.listTools()).tools.map((tool) => tool.name);
      const financeWriteNamesGrantedByFinanceWrite = financeTools
        .filter((tool) => !tool.readOnly && tool.scopes.every((scope) => scope === 'finance:write'))
        .map((tool) => tool.name);
      expect(writerTools.filter((name) => name.startsWith('finance_'))).toEqual(
        financeWriteNamesGrantedByFinanceWrite,
      );
      for (const toolName of readToolNames) {
        await expect(financeWriter.callTool({ name: toolName, arguments: {} })).rejects.toThrow(
          'Insufficient scope',
        );
      }

      const fullyScopedWriterTools = (await fullyScopedFinanceWriter.listTools()).tools.map(
        (tool) => tool.name,
      );
      expect(fullyScopedWriterTools.filter((name) => name.startsWith('finance_'))).toEqual(
        writeToolNames,
      );
    } finally {
      await financeReader.close();
      await financeWriter.close();
      await fullyScopedFinanceWriter.close();
    }
  });

  it('enforces travel read and write scopes for personal tokens at discovery and call time', async () => {
    vi.mocked(resolveMcpToken).mockImplementation(async (token) => {
      if (token === 'hmt_travel_read_token')
        return { ownerUserId: testUser.id, scopes: ['travel:read'] };
      if (token === 'hmt_travel_write_token')
        return { ownerUserId: testUser.id, scopes: ['travel:write'] };
      return null;
    });

    const travelTools = listTools().filter((tool) => tool.name.startsWith('travel_'));
    const readNames = travelTools.filter((tool) => tool.readOnly).map((tool) => tool.name);
    const writeNames = travelTools.filter((tool) => !tool.readOnly).map((tool) => tool.name);
    const reader = await createClient('hmt_travel_read_token');
    const writer = await createClient('hmt_travel_write_token');

    try {
      const discoveredRead = (await reader.listTools()).tools.map((tool) => tool.name);
      expect(discoveredRead.filter((name) => name.startsWith('travel_'))).toEqual(readNames);
      expect(readNames).toContain('travel_validate');
      expect(readNames).toContain('travel_timeline');
      await reader.callTool({ name: 'travel_validate', arguments: {} });
      for (const name of writeNames) {
        await expect(reader.callTool({ name, arguments: {} })).rejects.toThrow(
          'Insufficient scope',
        );
      }

      const discoveredWrite = (await writer.listTools()).tools.map((tool) => tool.name);
      expect(discoveredWrite.filter((name) => name.startsWith('travel_'))).toEqual(writeNames);
      for (const name of readNames) {
        await expect(writer.callTool({ name, arguments: {} })).rejects.toThrow(
          'Insufficient scope',
        );
      }
    } finally {
      await reader.close();
      await writer.close();
    }
  });

  it('rejects a valid personal token that has no MCP scopes', async () => {
    vi.mocked(resolveMcpToken).mockResolvedValue({
      ownerUserId: testUser.id,
      scopes: ['openid', 'profile'],
    });

    const response = await createApp().fetch(tokenRequest('hmt_no_mcp_scope_token'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: 'insufficient_scope' });
  });

  it('rejects an unknown or revoked hmt_ token with 401', async () => {
    vi.mocked(resolveMcpToken).mockResolvedValue(null);

    const response = await createApp().fetch(tokenRequest('hmt_unknown_token_value'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_token' });
  });
});
