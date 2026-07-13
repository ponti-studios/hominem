import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import type { AppContext, RpcUser } from '../rpc/middleware/auth';
import { requestIdMiddleware } from '../rpc/middleware/auth';
import { apiErrorHandler } from '../rpc/middleware/error';
import { validationErrorMiddleware } from '../rpc/middleware/validation';
import { mcpRoutes } from './routes';

const testUser: RpcUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'mcp@example.com',
  name: 'MCP Test User',
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
      c.set('user', testUser);
      c.set('userId', testUser.id);
      c.set('auth', {
        sub: testUser.id,
        sid: 'session-123',
        authTime: Math.floor(Date.now() / 1000),
      });
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
});
