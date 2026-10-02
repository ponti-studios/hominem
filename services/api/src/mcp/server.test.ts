import { pool } from '@hominem/db/core';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { Hono } from 'hono';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { AuthContext } from '../auth/types';
import type { AppContext, RpcUser } from '../rpc/middleware/auth';
import { requestIdMiddleware } from '../rpc/middleware/auth';
import { apiErrorHandler } from '../rpc/middleware/error';
import { validationErrorMiddleware } from '../rpc/middleware/validation';
import { careerWishlistAddOutputSchema } from '../schemas/career.schema';
import { createCollectionOutputSchema } from '../schemas/collections.schema';
import { toolOutput } from '../testkit/tool-result';
import { mcpRoutes, oauthDiscoveryRoutes } from './routes';
import { callTool, listTools, registerTool } from './tool-registry';

vi.mock('@better-auth/mcp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@better-auth/mcp')>()),
  requireMcpAuth:
    (
      _auth: unknown,
      handler: (request: Request, claims: Record<string, unknown>) => Promise<Response>,
    ) =>
    async (request: Request) => {
      const authorization = request.headers.get('authorization');
      if (!authorization) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: {
            'content-type': 'application/json',
            'www-authenticate':
              'Bearer scope="career:read travel:read" resource_metadata="http://localhost/.well-known/oauth-protected-resource/api/mcp"',
          },
        });
      }
      return handler(request, {
        sub: testUser.id,
        client_id: 'test-client',
        scope: request.headers.get('x-mcp-scopes') ?? 'career:read finance:read',
      }).catch(
        () => new Response(JSON.stringify({ error: 'insufficient_scope' }), { status: 403 }),
      );
    },
}));

vi.mock('@hominem/queues', () => ({ embeddingQueue: { add: async () => undefined } }));

vi.mock('../middleware/auth', () => ({
  setMcpAuthContext: async (
    c: { set: (key: 'auth', value: AuthContext) => void },
    claims: Record<string, unknown>,
  ) => {
    c.set('auth', {
      user: testUser,
      userId: testUser.id,
      clientId: typeof claims.client_id === 'string' ? claims.client_id : undefined,
      credential: 'mcp-oauth',
      scopes: typeof claims.scope === 'string' ? claims.scope.split(' ') : [],
    });
    return true;
  },
}));

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

function createApp(auth?: AuthContext) {
  const app = new Hono<AppContext>()
    .onError(apiErrorHandler)
    .use(requestIdMiddleware)
    .use(validationErrorMiddleware)
    .basePath('/api');

  if (auth) {
    app.use('*', async (c, next) => {
      c.set('auth', auth);
      await next();
    });
  }

  app.route('/mcp', mcpRoutes);

  return app;
}

const mcpAuthContext = {
  user: testUser,
  userId: testUser.id,
  credential: 'mcp-oauth',
  scopes: ['career:read', 'finance:read'],
} satisfies AuthContext;

async function createClient(app: Hono<AppContext>, scopes = 'career:read finance:read') {
  const transport = new StreamableHTTPClientTransport(new URL('http://localhost/api/mcp'), {
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set('authorization', 'Bearer test-token');
      headers.set('x-mcp-scopes', scopes);
      return app.fetch(new Request(input, { ...init, headers }));
    },
  });
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

// A client that auto-fulfils an embedded elicitation (Multi Round-Trip
// Requests, protocol revision 2026-07-28) with a fixed accept/decline action
// — exercises the same client-side handler path a spec-compliant MCP client
// (Claude Desktop, ChatGPT) uses, with zero Hominem-specific code.
async function createElicitingClient(
  app: Hono<AppContext>,
  action: 'accept' | 'decline',
  scopes: string,
) {
  const transport = new StreamableHTTPClientTransport(new URL('http://localhost/api/mcp'), {
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set('authorization', 'Bearer test-token');
      headers.set('x-mcp-scopes', scopes);
      return app.fetch(new Request(input, { ...init, headers }));
    },
  });
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    {
      capabilities: { elicitation: {} },
      // Multi Round-Trip Requests (elicitation embedded in tools/call) only
      // works against the modern era: this server's stateless deployment
      // (createMcpHandler's legacy: 'stateless' option) answers each 2025-era
      // request from a fresh per-request instance with no held connection,
      // so the SDK's 2025-compat legacy shim — which needs a live connection
      // to send a real server->client elicitation request — cannot run.
      // Pinning here proves the intended modern-client behavior; a legacy
      // client hitting this same tool gets no interactive confirmation at
      // all (see server.ts's createToolHandler comment for the caveat).
      versionNegotiation: { mode: { pin: '2026-07-28' } },
    },
  );
  client.setRequestHandler('elicitation/create', async () => ({ action }));
  await client.connect(transport);
  return client;
}

describe('mcp server transport', () => {
  it('advertises career:read in protected resource metadata', async () => {
    const app = new Hono().route('/', oauthDiscoveryRoutes);
    const response = await app.request('/.well-known/oauth-protected-resource/api/mcp');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      scopes_supported: expect.arrayContaining(['career:read']),
    });
  });

  it('advertises career:read in authorization server metadata', async () => {
    const app = new Hono().route('/', oauthDiscoveryRoutes);
    const response = await app.request('/.well-known/oauth-authorization-server');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      authorization_response_iss_parameter_supported: false,
      code_challenge_methods_supported: ['S256'],
      scopes_supported: expect.arrayContaining(['career:read']),
    });
  });

  it('supports path-aware OAuth authorization server discovery', async () => {
    const app = new Hono().route('/', oauthDiscoveryRoutes);
    const response = await app.request('/.well-known/oauth-authorization-server/api/auth');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      issuer: expect.stringContaining('/api/auth'),
      code_challenge_methods_supported: ['S256'],
    });
  });

  it.each([
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-authorization-server/api/mcp',
    '/api/auth/.well-known/oauth-authorization-server',
  ])('supports HEAD authorization metadata discovery at %s', async (path) => {
    const app = new Hono().route('/', oauthDiscoveryRoutes);
    const response = await app.request(path, { method: 'HEAD' });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.text()).resolves.toBe('');
  });

  it('requires authentication at the route boundary', async () => {
    const app = createApp();
    const response = await app.fetch(new Request('http://localhost/api/mcp', { method: 'GET' }));

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('scope=');
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    await expect(response.json()).resolves.toMatchObject({
      error: 'unauthorized',
    });
  });

  it('rejects an MCP token without career:read', async () => {
    const app = createApp({ ...mcpAuthContext, scopes: ['openid', 'profile'] });
    const response = await app.fetch(
      new Request('http://localhost/api/mcp', {
        method: 'GET',
        headers: { authorization: 'Bearer test-token', 'x-mcp-scopes': 'openid profile' },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: 'insufficient_scope',
    });
  });

  it('does not authorize a Better Auth cookie session as MCP', async () => {
    const app = createApp({
      ...mcpAuthContext,
      credential: 'session',
      sessionId: 'session-123',
    });
    const response = await app.fetch(new Request('http://localhost/api/mcp', { method: 'GET' }));

    expect(response.status).toBe(401);
  });

  it('connects and initializes over streamable HTTP', async () => {
    const client = await createClient(createApp(mcpAuthContext));
    try {
      expect(client.getServerVersion()).toMatchObject({
        name: 'Hominem MCP',
        version: '1.0.0',
      });
    } finally {
      await client.close();
    }
  });

  it('lists registered career tools', async () => {
    const client = await createClient(createApp(mcpAuthContext));
    try {
      const tools = await client.listTools();
      const toolNames = tools.tools.map((t) => t.name);
      expect(toolNames).toContain('career_profile');
      expect(toolNames).toContain('career_engagements');
      expect(toolNames).toContain('finance_net_worth');
      expect(toolNames).not.toContain('career_wishlist_add');
    } finally {
      await client.close();
    }
  });

  it('returns tools/list in a stable, deterministic order', async () => {
    const clientA = await createClient(createApp(mcpAuthContext));
    const clientB = await createClient(createApp(mcpAuthContext));
    try {
      const [namesA, namesB] = await Promise.all([
        clientA.listTools().then((result) => result.tools.map((t) => t.name)),
        clientB.listTools().then((result) => result.tools.map((t) => t.name)),
      ]);

      expect(namesA).toEqual(namesB);
      expect(namesA).toEqual([...namesA].sort((a, b) => a.localeCompare(b)));
    } finally {
      await clientA.close();
      await clientB.close();
    }
  });

  it('advertises ChatGPT safety annotations and invocation status', async () => {
    const client = await createClient(createApp(mcpAuthContext), 'career:read career:write');
    try {
      const tools = await client.listTools();
      const deleteTool = tools.tools.find((tool) => tool.name === 'career_wishlist_remove');
      const readTool = tools.tools.find((tool) => tool.name === 'career_engagements');

      expect(deleteTool?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      });
      expect(deleteTool?._meta).toMatchObject({
        'openai/toolInvocation/invoking': expect.any(String),
        'openai/toolInvocation/invoked': expect.any(String),
      });
      expect(readTool?.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      });
    } finally {
      await client.close();
    }
  });

  it('declares task_complete idempotent, not just non-destructive', async () => {
    // Regression: the old name-regex fallback (delete|remove|update|save)
    // never matched "complete", so this tool used to be mislabeled
    // idempotentHint: false even though completing/reopening a task twice
    // with the same value is a no-op. Now declared explicitly in tasks.ts.
    const client = await createClient(createApp(mcpAuthContext), 'task:read task:write');
    try {
      const tools = await client.listTools();
      const completeTool = tools.tools.find((tool) => tool.name === 'task_complete');

      expect(completeTool?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      });
    } finally {
      await client.close();
    }
  });

  it('requires only finance:read for finance tools', () => {
    const financeTools = listTools().filter((tool) => tool.name.startsWith('finance_'));

    expect(financeTools).not.toHaveLength(0);
    expect(
      financeTools.every((tool) => tool.scopes.length === 1 && tool.scopes[0] === 'finance:read'),
    ).toBe(true);
  });

  it('invokes a career tool with a scoped MCP token', async () => {
    const client = await createClient(createApp(mcpAuthContext));
    try {
      const result = await client.callTool({
        name: 'career_engagements',
        arguments: { limit: 1 },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ engagements: [] });
    } finally {
      await client.close();
    }
  });

  it('does not advertise a wishlist mutation without career:write', async () => {
    const client = await createClient(createApp(mcpAuthContext));
    try {
      await expect(
        client.callTool({ name: 'career_wishlist_add', arguments: { company: 'Acme' } }),
      ).rejects.toThrow('not found');
    } finally {
      await client.close();
    }
  });

  it('invokes the profile tool with an object-shaped result', async () => {
    const client = await createClient(createApp(mcpAuthContext));
    try {
      const result = await client.callTool({
        name: 'career_profile',
        arguments: {},
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ profile: null });
    } finally {
      await client.close();
    }
  });

  it('rejects tool calls with invalid input', async () => {
    const client = await createClient(createApp(mcpAuthContext));
    try {
      const result = await client.callTool({
        name: 'career_engagements',
        arguments: { limit: 'not-a-number' },
      });

      expect(result.isError).toBe(true);
      expect(result.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringMatching(/-32602|validation|expected/i),
          }),
        ]),
      );
    } finally {
      await client.close();
    }
  });

  it('does not return internal tool errors to the client', async () => {
    const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    registerTool(
      {
        name: 'failing_tool',
        title: 'Failing test tool',
        description: 'Fails for error redaction coverage.',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        readOnly: true,
        scopes: ['career:read'],
        resultCap: 1,
      },
      async () => {
        throw new Error('secret database detail');
      },
    );

    const client = await createClient(createApp(mcpAuthContext));
    try {
      const result = await client.callTool({
        name: 'failing_tool',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: 'text', text: 'Unable to complete the MCP tool request.' },
      ]);
      expect(JSON.stringify(result)).not.toContain('secret database detail');
      expect(warningSpy).toHaveBeenCalledWith(
        expect.stringContaining('[mcp] tool invocation failed'),
      );
    } finally {
      await client.close();
      warningSpy.mockRestore();
    }
  });

  it('returns a client error for malformed JSON-RPC requests', async () => {
    const app = createApp(mcpAuthContext);
    const response = await app.fetch(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
          authorization: 'Bearer test-token',
        },
        body: '{',
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
  });

  describe('protocol-level confirmation (multi round-trip requests)', () => {
    const writeScopes = 'career:read career:write';

    beforeAll(async () => {
      await pool.query(
        'INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [testUser.id, testUser.name, testUser.email, true],
      );
    });

    async function addWishlistCompany(company: string): Promise<string> {
      const writer = await createClient(createApp(mcpAuthContext), writeScopes);
      try {
        const added = await writer.callTool({
          name: 'career_wishlist_add',
          arguments: { company },
        });
        return toolOutput(added, careerWishlistAddOutputSchema).company.id;
      } finally {
        await writer.close();
      }
    }

    it('deletes only after the client accepts the embedded elicitation', async () => {
      const companyId = await addWishlistCompany('MRTR Accept Co');

      const accepting = await createElicitingClient(
        createApp(mcpAuthContext),
        'accept',
        writeScopes,
      );
      try {
        const result = await accepting.callTool({
          name: 'career_wishlist_remove',
          arguments: { id: companyId },
        });
        expect(result.isError).not.toBe(true);
        expect(result.structuredContent).toMatchObject({ removed: true });
      } finally {
        await accepting.close();
      }
    });

    it('does not delete when the client declines the embedded elicitation', async () => {
      const companyId = await addWishlistCompany('MRTR Decline Co');

      const declining = await createElicitingClient(
        createApp(mcpAuthContext),
        'decline',
        writeScopes,
      );
      try {
        const result = await declining.callTool({
          name: 'career_wishlist_remove',
          arguments: { id: companyId },
        });
        // A generic cancellation has no schema-shaped payload to offer (the
        // shape differs per tool), so it comes back as isError: true with a
        // human-readable message — see buildCancelledResult in server.ts.
        expect(result.isError).toBe(true);
        expect(result.content).toEqual([
          { type: 'text', text: expect.stringContaining('cancelled') },
        ]);
      } finally {
        await declining.close();
      }

      // The row must still be there — prove it, then clean it up via an
      // accepting client so the test DB doesn't accumulate rows.
      const cleanup = await createElicitingClient(createApp(mcpAuthContext), 'accept', writeScopes);
      try {
        const removed = await cleanup.callTool({
          name: 'career_wishlist_remove',
          arguments: { id: companyId },
        });
        expect(removed.structuredContent).toMatchObject({ removed: true });
      } finally {
        await cleanup.close();
      }
    });

    it('completes in one round trip with no elicitation when there is nothing to confirm', async () => {
      // A plain client with no elicitation handler registered: if the server
      // ever sent an embedded elicitation here, the call would hang/fail.
      const client = await createClient(createApp(mcpAuthContext), writeScopes);
      try {
        const result = await client.callTool({
          name: 'career_wishlist_remove',
          arguments: { id: '00000000-0000-4000-8000-000000000000' },
        });
        expect(result.isError).not.toBe(true);
        expect(result.structuredContent).toMatchObject({ removed: false });
      } finally {
        await client.close();
      }
    });

    it('still confirms a requiresConfirmation tool that has no preview function', async () => {
      // Regression test: create_collection declares requiresConfirmation but
      // has no preview function. A plain client with no elicitation handler
      // must NOT be able to execute it — if the server ever fell through to
      // immediate execution here (the bug this guards against), the call
      // would succeed instead of hanging/erroring.
      const collectionsScopes = 'collections:read collections:write';
      const client = await createClient(createApp(mcpAuthContext), collectionsScopes);
      try {
        const result = await client.callTool({
          name: 'create_collection',
          arguments: { name: 'No-Preview Confirmation Test' },
        });
        // A plain client can't answer the embedded elicitation at all, so the
        // call must fail rather than execute immediately.
        expect(result.isError).toBe(true);
        expect(result.structuredContent).toBeUndefined();
      } finally {
        await client.close();
      }

      const accepting = await createElicitingClient(
        createApp(mcpAuthContext),
        'accept',
        collectionsScopes,
      );
      try {
        const result = await accepting.callTool({
          name: 'create_collection',
          arguments: { name: 'No-Preview Confirmation Test' },
        });
        expect(result.isError).not.toBe(true);
        expect(result.structuredContent).toMatchObject({
          collection: { name: 'No-Preview Confirmation Test' },
        });
      } finally {
        await accepting.close();
      }
    });

    it('confirms delete_collection with a preview and only deletes on accept', async () => {
      const collectionsScopes = 'collections:read collections:write';

      const accepting = await createElicitingClient(
        createApp(mcpAuthContext),
        'accept',
        collectionsScopes,
      );
      let collectionId: string;
      try {
        const created = await accepting.callTool({
          name: 'create_collection',
          arguments: { name: 'Preview Delete Test' },
        });
        collectionId = toolOutput(created, createCollectionOutputSchema).collection.id;
      } finally {
        await accepting.close();
      }

      const declining = await createElicitingClient(
        createApp(mcpAuthContext),
        'decline',
        collectionsScopes,
      );
      try {
        const result = await declining.callTool({
          name: 'delete_collection',
          arguments: { collectionId },
        });
        expect(result.isError).toBe(true);
        expect(result.content).toEqual([
          { type: 'text', text: expect.stringContaining('cancelled') },
        ]);
        const detail = await declining.callTool({
          name: 'collection_detail',
          arguments: { collectionId },
        });
        expect(detail.structuredContent).toMatchObject({
          collection: { name: 'Preview Delete Test' },
        });
      } finally {
        await declining.close();
      }

      const confirming = await createElicitingClient(
        createApp(mcpAuthContext),
        'accept',
        collectionsScopes,
      );
      try {
        const result = await confirming.callTool({
          name: 'delete_collection',
          arguments: { collectionId },
        });
        expect(result.structuredContent).toEqual({ deleted: true });
      } finally {
        await confirming.close();
      }
    });
  });

  describe('resources, completions and prompts', () => {
    const otherUserId = '22222222-2222-4222-8222-222222222222';
    const readScopes = 'career:read memory:read task:read notes:read collections:read';
    let taskId: string;
    let noteId: string;
    let collectionId: string;
    let otherTaskId: string;
    let otherNoteId: string;
    let otherCollectionId: string;

    function idOf(result: { structuredContent: unknown }, key: string): string {
      const parsed = z
        .object({ [key]: z.object({ id: z.string() }) })
        .parse(result.structuredContent);
      return z.object({ id: z.string() }).parse(parsed[key]).id;
    }

    beforeAll(async () => {
      for (const [id, email] of [
        [testUser.id, testUser.email],
        [otherUserId, 'other-mcp@example.com'],
      ] as const) {
        await pool.query(
          'INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
          [id, 'MCP User', email, true],
        );
      }
      taskId = idOf(
        await callTool(testUser.id, 'task_create', {
          title: 'Mine: pay rent',
          artifactType: 'task',
        }),
        'task',
      );
      noteId = idOf(
        await callTool(testUser.id, 'note_create', { title: 'Mine', content: 'my note' }),
        'note',
      );
      collectionId = idOf(
        await callTool(testUser.id, 'create_collection', { name: 'Mine collection' }),
        'collection',
      );
      otherTaskId = idOf(
        await callTool(otherUserId, 'task_create', {
          title: 'Theirs: secret task',
          artifactType: 'task',
        }),
        'task',
      );
      otherNoteId = idOf(
        await callTool(otherUserId, 'note_create', { title: 'Theirs', content: 'secret note' }),
        'note',
      );
      otherCollectionId = idOf(
        await callTool(otherUserId, 'create_collection', { name: 'Theirs collection' }),
        'collection',
      );
    });

    async function withClient<T>(scopes: string, run: (client: Client) => Promise<T>): Promise<T> {
      const client = await createClient(createApp(mcpAuthContext), scopes);
      try {
        return await run(client);
      } finally {
        await client.close();
      }
    }

    it('lists fixed resources and templates only for granted scopes', async () => {
      await withClient(readScopes, async (client) => {
        const { resources } = await client.listResources();
        const uris = resources.map((resource) => resource.uri);
        expect(uris).toEqual(
          expect.arrayContaining([
            'hominem://profile',
            'hominem://memories',
            `hominem://tasks/${taskId}`,
            `hominem://notes/${noteId}`,
            `hominem://collections/${collectionId}`,
          ]),
        );
        const { resourceTemplates } = await client.listResourceTemplates();
        expect(resourceTemplates.map((template) => template.uriTemplate).sort()).toEqual([
          'hominem://collections/{id}',
          'hominem://notes/{id}',
          'hominem://tasks/{id}',
        ]);
      });

      await withClient('task:read', async (client) => {
        const { resources } = await client.listResources();
        const uris = resources.map((resource) => resource.uri);
        expect(uris).toContain(`hominem://tasks/${taskId}`);
        expect(uris.some((uri) => uri.startsWith('hominem://notes/'))).toBe(false);
        expect(uris).not.toContain('hominem://profile');
      });
    });

    it("never lists or reads another user's data", async () => {
      await withClient(readScopes, async (client) => {
        const { resources } = await client.listResources();
        const uris = resources.map((resource) => resource.uri);
        expect(uris).not.toContain(`hominem://tasks/${otherTaskId}`);
        expect(uris).not.toContain(`hominem://notes/${otherNoteId}`);
        expect(uris).not.toContain(`hominem://collections/${otherCollectionId}`);

        for (const uri of [
          `hominem://tasks/${otherTaskId}`,
          `hominem://notes/${otherNoteId}`,
          `hominem://collections/${otherCollectionId}`,
        ]) {
          await expect(client.readResource({ uri })).rejects.toThrow();
        }
      });
    });

    it('reads own resources and rejects malformed or unknown ids', async () => {
      await withClient(readScopes, async (client) => {
        const task = await client.readResource({ uri: `hominem://tasks/${taskId}` });
        expect(task.contents[0]).toMatchObject({ mimeType: 'application/json' });
        expect(JSON.stringify(task.contents[0])).toContain('Mine: pay rent');

        const note = await client.readResource({ uri: `hominem://notes/${noteId}` });
        expect(JSON.stringify(note.contents[0])).toContain('my note');

        const collection = await client.readResource({
          uri: `hominem://collections/${collectionId}`,
        });
        expect(JSON.stringify(collection.contents[0])).toContain('Mine collection');

        const memories = await client.readResource({ uri: 'hominem://memories' });
        expect(memories.contents).toHaveLength(1);

        await expect(client.readResource({ uri: 'hominem://tasks/not-a-uuid' })).rejects.toThrow();
        await expect(
          client.readResource({ uri: 'hominem://tasks/99999999-9999-4999-8999-999999999999' }),
        ).rejects.toThrow();
      });
    });

    it("completes template ids from the caller's own records only", async () => {
      await withClient(readScopes, async (client) => {
        const completion = await client.complete({
          ref: { type: 'ref/resource', uri: 'hominem://tasks/{id}' },
          argument: { name: 'id', value: '' },
        });
        expect(completion.completion.values).toContain(taskId);
        expect(completion.completion.values).not.toContain(otherTaskId);

        const filtered = await client.complete({
          ref: { type: 'ref/resource', uri: 'hominem://tasks/{id}' },
          argument: { name: 'id', value: 'ffffffff' },
        });
        expect(filtered.completion.values).toEqual([]);
      });
    });

    it('serves possession and container resources with scope gating and isolation', async () => {
      const created = async (userId: string, tool: string, input: unknown, key: string) =>
        idOf(await callTool(userId, tool, input), key);
      const containerId = await created(
        testUser.id,
        'container_create',
        { name: 'Res box' },
        'container',
      );
      const possessionId = await created(
        testUser.id,
        'possession_create',
        { name: 'Res lamp', containerId },
        'possession',
      );
      const otherContainerId = await created(
        otherUserId,
        'container_create',
        { name: 'Their box' },
        'container',
      );
      const otherPossessionId = await created(
        otherUserId,
        'possession_create',
        { name: 'Their lamp' },
        'possession',
      );

      await withClient('possessions:read', async (client) => {
        const { resourceTemplates } = await client.listResourceTemplates();
        expect(resourceTemplates.map((template) => template.uriTemplate).sort()).toEqual([
          'hominem://containers/{id}',
          'hominem://possessions/{id}',
        ]);

        const uris = (await client.listResources()).resources.map((resource) => resource.uri);
        expect(uris).toEqual(
          expect.arrayContaining([
            `hominem://possessions/${possessionId}`,
            `hominem://containers/${containerId}`,
          ]),
        );
        expect(uris).not.toContain(`hominem://possessions/${otherPossessionId}`);
        expect(uris).not.toContain(`hominem://containers/${otherContainerId}`);

        const lamp = await client.readResource({ uri: `hominem://possessions/${possessionId}` });
        expect(JSON.stringify(lamp.contents[0])).toContain('Res lamp');
        const box = await client.readResource({ uri: `hominem://containers/${containerId}` });
        expect(JSON.stringify(box.contents[0])).toContain('Res box');

        for (const uri of [
          `hominem://possessions/${otherPossessionId}`,
          `hominem://containers/${otherContainerId}`,
          'hominem://possessions/not-a-uuid',
          'hominem://containers/not-a-uuid',
          'hominem://containers/99999999-9999-4999-8999-999999999999',
        ]) {
          await expect(client.readResource({ uri })).rejects.toThrow();
        }

        for (const [uri, own, theirs] of [
          ['hominem://possessions/{id}', possessionId, otherPossessionId],
          ['hominem://containers/{id}', containerId, otherContainerId],
        ] as const) {
          const completion = await client.complete({
            ref: { type: 'ref/resource', uri },
            argument: { name: 'id', value: '' },
          });
          expect(completion.completion.values).toContain(own);
          expect(completion.completion.values).not.toContain(theirs);
        }
      });

      await withClient('task:read', async (client) => {
        const { resourceTemplates } = await client.listResourceTemplates();
        expect(resourceTemplates.map((template) => template.uriTemplate)).not.toContain(
          'hominem://possessions/{id}',
        );
      });
    });

    it('lists prompts by granted scope and renders them with completions', async () => {
      await withClient(readScopes, async (client) => {
        const { prompts } = await client.listPrompts();
        expect(prompts.map((prompt) => prompt.name).sort()).toEqual(
          ['plan_my_day', 'weekly_review', 'career_update_draft'].sort(),
        );
      });

      await withClient('task:read notes:read notes:write', async (client) => {
        const { prompts } = await client.listPrompts();
        expect(prompts.map((prompt) => prompt.name).sort()).toEqual([
          'capture_note',
          'plan_my_day',
          'weekly_review',
        ]);

        const review = await client.getPrompt({
          name: 'weekly_review',
          arguments: { period: 'month' },
        });
        const first = review.messages[0]?.content;
        expect(first).toMatchObject({ type: 'text', text: expect.stringContaining('task_list') });
        expect(JSON.stringify(first)).toContain('month');

        const completion = await client.complete({
          ref: { type: 'ref/prompt', name: 'plan_my_day' },
          argument: { name: 'energy', value: 'h' },
        });
        expect(completion.completion.values).toEqual(['high']);
      });
    });
  });
});
