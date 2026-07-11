import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { db, sql } from '@hominem/db';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AppContext, RpcUser } from '../rpc/middleware/auth';
import { apiErrorHandler } from '../rpc/middleware/error';
import { requestIdMiddleware } from '../rpc/middleware/auth';
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

const OLLAMA_URL = 'http://localhost:11434/api/chat';
const MODEL = 'gemma4:12b';

function createApp() {
  const app = new Hono<AppContext>()
    .onError(apiErrorHandler)
    .use(requestIdMiddleware)
    .use(validationErrorMiddleware)
    .basePath('/api');

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

  app.route('/mcp', mcpRoutes);
  return app;
}

async function createClient(app: Hono<AppContext>) {
  const transport = new StreamableHTTPClientTransport(new URL('http://localhost/api/mcp'), {
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      // Grant all current tool scopes for the eval session
      headers.set('x-mcp-scopes', 'career:read');
      const req = new Request(input, { ...init, headers });
      return app.fetch(req);
    },
  });
  const client = new Client({ name: 'eval-client', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

function mcpToolToOllamaTool(tool: { name: string; description?: string; inputSchema?: Record<string, unknown> }) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description ?? '',
      parameters: tool.inputSchema ?? { type: 'object', properties: {} },
    },
  };
}

function ollamaMessage(role: string, content: string, toolCalls?: unknown) {
  const msg: Record<string, unknown> = { role, content };
  if (toolCalls) msg.tool_calls = toolCalls;
  return msg;
}

async function ollamaChat(messages: unknown[], tools: unknown[]) {
  const body = { model: MODEL, messages, tools, stream: false };
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<{
    message: {
      role: string;
      content: string;
      tool_calls?: Array<{
        function: { name: string; arguments: Record<string, unknown> };
      }>;
    };
    done: boolean;
  }>;
}

const TIMEOUT = 120_000;

// Seed a test user with portfolio data so the LLM has real data to query.
// The test user ID must match the one in createApp() below.
const SEED_USER_ID = '11111111-1111-4111-8111-111111111111';
let seedPortfolioId: string | null = null;

beforeAll(async () => {
  // Create test user
  await sql`
    INSERT INTO public.user (id, name, email, "emailVerified", "createdAt", "updatedAt")
    VALUES (${SEED_USER_ID}, 'Eval User', 'eval@test.com', true, now(), now())
    ON CONFLICT (id) DO NOTHING
  `.execute(db);

  // Create portfolio
  const result = await sql<{ id: string }>`
    INSERT INTO app.portfolios (
      owner_userid, slug, title, name, job_title, bio, tagline,
      current_location, email, is_public, is_active
    ) VALUES (
      ${SEED_USER_ID}, 'eval-user', 'Eval User Portfolio', 'Eval User',
      'Senior Engineer', 'A seasoned engineer with years of experience.',
      'Building great things', 'San Francisco, CA', 'eval@test.com',
      true, true
    )
    ON CONFLICT (owner_userid) DO UPDATE SET is_public = true
    RETURNING id
  `.execute(db);
  seedPortfolioId = result.rows[0].id;

  // Create work experiences
  await sql`
    INSERT INTO app.work_experiences (portfolio_id, role, company, description, start_date, end_date, sort_order)
    VALUES
      (${seedPortfolioId}, 'Senior Engineer', 'Acme Corp', 'Built the core platform.', '2020-01-01', '2022-06-01', 1),
      (${seedPortfolioId}, 'Lead Engineer', 'TechStart Inc', 'Led a team of 5 engineers.', '2022-06-01', '2024-01-01', 2),
      (${seedPortfolioId}, 'Staff Engineer', 'BigCloud Industries', 'Architected cloud infrastructure.', '2024-01-01', null, 3)
  `.execute(db);

  // Create skills
  await sql`
    INSERT INTO app.skills (portfolio_id, name, category, level)
    VALUES
      (${seedPortfolioId}, 'TypeScript', 'Technical', 5),
      (${seedPortfolioId}, 'System Design', 'Architecture', 4),
      (${seedPortfolioId}, 'Team Leadership', 'Management', 4)
  `.execute(db);
});

afterAll(async () => {
  if (seedPortfolioId) {
    // Cascading delete: portfolio → work_experiences, skills
    await sql`DELETE FROM app.portfolios WHERE id = ${seedPortfolioId}`.execute(db);
  }
  await sql`DELETE FROM public.user WHERE id = ${SEED_USER_ID}`.execute(db);
});

describe('MCP tools via Ollama LLM', () => {
  it('connects to Ollama', async () => {
    const res = await fetch('http://localhost:11434/api/tags');
    expect(res.ok).toBe(true);
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const models = (data.models ?? []).map((m) => m.name);
    expect(models).toContain(MODEL);
  }, TIMEOUT);

  it('LLM calls get_career_portfolio tool and reports result', async () => {
    const app = createApp();
    const mcp = await createClient(app);

    try {
      // 1. Get tool definitions from MCP server
      const { tools: mcpTools } = await mcp.listTools();
      expect(mcpTools.length).toBeGreaterThan(0);

      const portfolioTool = mcpTools.find((t) => t.name === 'get_career_portfolio');
      expect(portfolioTool).toBeDefined();

      // 2. Convert to Ollama tool format
      const ollamaTools = mcpTools.map(mcpToolToOllamaTool);

      // 3. Send prompt that should trigger a tool call
      const messages = [
        ollamaMessage('user', "Look up my career portfolio and tell me what you find."),
      ];

      const firstResp = await ollamaChat(messages, ollamaTools);
      expect(firstResp.done).toBe(true);
      expect(firstResp.message.tool_calls).toBeDefined();
      expect(firstResp.message.tool_calls!.length).toBeGreaterThanOrEqual(1);

      const toolCall = firstResp.message.tool_calls![0];
      expect(toolCall.function.name).toBe('get_career_portfolio');

      // 4. Execute the tool via MCP client
      const toolResult = await mcp.callTool({
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
      });

      // 5. Send result back to Ollama
      const resultContent = (toolResult.content as Array<{ type: string; text?: string }>)
        .map((c) => c.text ?? '')
        .join('\n');

      messages.push(
        ollamaMessage('assistant', firstResp.message.content, firstResp.message.tool_calls),
        ollamaMessage('tool', resultContent),
      );

      const finalResp = await ollamaChat(messages, ollamaTools);

      // 6. LLM should produce a coherent final response based on the tool result
      expect(finalResp.message.content).toBeTruthy();
      expect(finalResp.message.content.length).toBeGreaterThan(50);

      // Seeded portfolio has Acme Corp, TechStart Inc, BigCloud — LLM should mention them
      const text = finalResp.message.content;
      expect(text).toMatch(/Acme|TechStart|BigCloud/);

      console.log('\n=== LLM Eval Result ===');
      console.log(`Tool called: ${toolCall.function.name}`);
      console.log(`Arguments: ${JSON.stringify(toolCall.function.arguments)}`);
      console.log(`Tool result: ${resultContent}`);
      console.log(`Final response: ${finalResp.message.content}`);
      console.log('=== End Eval ===\n');
    } finally {
      await mcp.close();
    }
  }, TIMEOUT);
});
