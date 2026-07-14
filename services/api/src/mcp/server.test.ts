import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import type { AuthContext } from '../auth/types';
import type { AppContext, RpcUser } from '../rpc/middleware/auth';
import { requestIdMiddleware } from '../rpc/middleware/auth';
import { apiErrorHandler } from '../rpc/middleware/error';
import { validationErrorMiddleware } from '../rpc/middleware/validation';
import { mcpRoutes } from './routes';

const testUser: RpcUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'mcp@example.com',
  name: 'MCP Test User',
  emailVerified: true,
  image: null,
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createApp(authenticated: boolean) {
  const app = new Hono<AppContext>()
    .onError(apiErrorHandler)
    .use(requestIdMiddleware)
    .use(validationErrorMiddleware)
    .basePath('/api');

  if (authenticated) {
    app.use('*', async (c, next) => {
      c.set('auth', {
        user: testUser,
        userId: testUser.id,
        sessionId: 'session-123',
        credential: 'session',
        scopes: process.env.NODE_ENV === 'production' ? [] : ['career:read'],
      } satisfies AuthContext);
      await next();
    });
  }

  app.route('/mcp', mcpRoutes);

  return app;
}

async function createClient(app: Hono<AppContext>) {
  const transport = new StreamableHTTPClientTransport(new URL('http://localhost/api/mcp'), {
    fetch: async (input, init) => app.fetch(new Request(input, init)),
  });
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

describe('mcp server transport', () => {
  it('requires authentication at the route boundary', async () => {
    const app = createApp(false);
    const response = await app.fetch(new Request('http://localhost/api/mcp', { method: 'GET' }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('connects and initializes over streamable HTTP', async () => {
    const client = await createClient(createApp(true));
    try {
      expect(client.getServerVersion()).toMatchObject({ name: 'Hominem MCP', version: '1.0.0' });
    } finally {
      await client.close();
    }
  });

  it('lists registered career tools', async () => {
    const client = await createClient(createApp(true));
    try {
      const tools = await client.listTools();
      const toolNames = tools.tools.map((t) => t.name);
      expect(toolNames).toContain('get_career_portfolio');
      expect(toolNames).toContain('list_career_experiences');
    } finally {
      await client.close();
    }
  });

  it('rejects tool calls with invalid input', async () => {
    const client = await createClient(createApp(true));
    try {
      const result = await client.callTool({
        name: 'list_career_experiences',
        arguments: { limit: 'not-a-number' },
      });

      expect(result.isError).toBe(true);
      expect(result.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ text: expect.stringMatching(/-32602|validation|expected/i) }),
        ]),
      );
    } finally {
      await client.close();
    }
  });

  it('returns a client error for malformed JSON-RPC requests', async () => {
    const app = createApp(true);
    const response = await app.fetch(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
        },
        body: '{',
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
  });
});
