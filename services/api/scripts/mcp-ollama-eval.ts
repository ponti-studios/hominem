import { db, sql } from '@hominem/db';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Hono } from 'hono';

import type { AuthContext } from '../src/auth/types';
import { mcpRoutes } from '../src/mcp/routes';
import type { AppContext, RpcUser } from '../src/rpc/middleware/auth';
import { requestIdMiddleware } from '../src/rpc/middleware/auth';
import { apiErrorHandler } from '../src/rpc/middleware/error';
import { validationErrorMiddleware } from '../src/rpc/middleware/validation';

const TEST_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5434/app-test';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const OLLAMA_URL = new URL('/api/chat', OLLAMA_BASE_URL).toString();
const OLLAMA_TAGS_URL = new URL('/api/tags', OLLAMA_BASE_URL).toString();
const MODEL = process.env.OLLAMA_MODEL ?? 'gemma4:12b';
const SEED_USER_ID = '11111111-1111-4111-8111-111111111111';
const TIMEOUT = 120_000;

const testUser: RpcUser = {
  id: SEED_USER_ID,
  email: 'mcp@example.com',
  name: 'MCP Test User',
  emailVerified: true,
  image: null,
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createApp() {
  const app = new Hono<AppContext>()
    .onError(apiErrorHandler)
    .use(requestIdMiddleware)
    .use(validationErrorMiddleware)
    .basePath('/api');

  app.use('*', async (c, next) => {
    c.set('auth', {
      user: testUser,
      userId: testUser.id,
      sessionId: 'session-123',
      credential: 'session',
      scopes: ['career:read'],
    } satisfies AuthContext);
    await next();
  });

  app.route('/mcp', mcpRoutes);
  return app;
}

async function createClient(app: Hono<AppContext>) {
  const transport = new StreamableHTTPClientTransport(new URL('http://localhost/api/mcp'), {
    fetch: async (input, init) => app.fetch(new Request(input, init)),
  });
  const client = new Client({ name: 'ollama-eval', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

function mcpToolToOllamaTool(tool: {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}) {
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
  const message: Record<string, unknown> = { role, content };
  if (toolCalls) message.tool_calls = toolCalls;
  return message;
}

async function ollamaChat(messages: unknown[], tools: unknown[]) {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, tools, stream: false }),
    signal: AbortSignal.timeout(TIMEOUT),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<{
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

async function seedFixtures() {
  await sql`
    INSERT INTO public.user (id, name, email, "emailVerified", "createdAt", "updatedAt")
    VALUES (${SEED_USER_ID}, 'Eval User', 'eval@test.com', true, now(), now())
    ON CONFLICT (id) DO NOTHING
  `.execute(db);

  const result = await sql<{ id: string }>`
    INSERT INTO app.portfolios (
      owner_userid, slug, title, name, job_title, bio, tagline,
      current_location, email, is_public, is_active
    ) VALUES (
      ${SEED_USER_ID}, 'eval-user', 'Eval User Portfolio', 'Eval User',
      'Senior Engineer', 'A seasoned engineer with years of experience.',
      'Building great things', 'San Francisco, CA', 'eval@test.com', true, true
    )
    ON CONFLICT (owner_userid) DO UPDATE SET is_public = true
    RETURNING id
  `.execute(db);
  const portfolioId = result.rows[0]?.id;
  if (!portfolioId) throw new Error('Failed to seed the MCP eval portfolio');

  await sql`
    INSERT INTO app.work_experiences (portfolio_id, role, company, description, start_date, end_date, sort_order)
    VALUES
      (${portfolioId}, 'Senior Engineer', 'Acme Corp', 'Built the core platform.', '2020-01-01', '2022-06-01', 1),
      (${portfolioId}, 'Lead Engineer', 'TechStart Inc', 'Led a team of 5 engineers.', '2022-06-01', '2024-01-01', 2),
      (${portfolioId}, 'Staff Engineer', 'BigCloud Industries', 'Architected cloud infrastructure.', '2024-01-01', null, 3)
  `.execute(db);

  await sql`
    INSERT INTO app.skills (portfolio_id, name, category, level)
    VALUES
      (${portfolioId}, 'TypeScript', 'Technical', 5),
      (${portfolioId}, 'System Design', 'Architecture', 4),
      (${portfolioId}, 'Team Leadership', 'Management', 4)
  `.execute(db);

  return portfolioId;
}

async function cleanupFixtures(portfolioId: string) {
  await sql`DELETE FROM app.portfolios WHERE id = ${portfolioId}`.execute(db);
  await sql`DELETE FROM public.user WHERE id = ${SEED_USER_ID}`.execute(db);
}

async function run() {
  if (process.env.DATABASE_URL !== TEST_DATABASE_URL) {
    throw new Error(`DATABASE_URL must be ${TEST_DATABASE_URL}`);
  }

  const tagsResponse = await fetch(OLLAMA_TAGS_URL, {
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!tagsResponse.ok) throw new Error(`Ollama is unavailable at ${OLLAMA_BASE_URL}`);

  const tags = (await tagsResponse.json()) as { models?: Array<{ name: string }> };
  if (!(tags.models ?? []).some((model) => model.name === MODEL)) {
    throw new Error(`Ollama model '${MODEL}' is not installed at ${OLLAMA_BASE_URL}`);
  }

  const portfolioId = await seedFixtures();
  try {
    const mcp = await createClient(createApp());
    try {
      const { tools: mcpTools } = await mcp.listTools();
      if (!mcpTools.some((tool) => tool.name === 'get_career_portfolio')) {
        throw new Error('get_career_portfolio tool is not registered');
      }

      const messages = [
        ollamaMessage('user', 'Look up my career portfolio and tell me what you find.'),
      ];
      const ollamaTools = mcpTools.map(mcpToolToOllamaTool);
      const firstResponse = await ollamaChat(messages, ollamaTools);
      const toolCall = firstResponse.message.tool_calls?.[0];
      if (!firstResponse.done || !toolCall) throw new Error('Ollama did not request an MCP tool');
      if (toolCall.function.name !== 'get_career_portfolio') {
        throw new Error(`Ollama selected unexpected tool: ${toolCall.function.name}`);
      }

      const toolResult = await mcp.callTool({
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
      });
      const resultContent = (toolResult.content as Array<{ text?: string }>)
        .map((content) => content.text ?? '')
        .join('\n');

      messages.push(
        ollamaMessage('assistant', firstResponse.message.content, firstResponse.message.tool_calls),
        ollamaMessage('tool', resultContent),
      );
      const finalResponse = await ollamaChat(messages, ollamaTools);
      if (finalResponse.message.content.length <= 20) {
        throw new Error('Ollama returned an unexpectedly short final response');
      }

      console.log('\n=== MCP Ollama Eval Result ===');
      console.log(`Tool called: ${toolCall.function.name}`);
      console.log(`Arguments: ${JSON.stringify(toolCall.function.arguments)}`);
      console.log(`Tool result: ${resultContent}`);
      console.log(`Final response: ${finalResponse.message.content}`);
      console.log('=== End Eval ===\n');
    } finally {
      await mcp.close();
    }
  } finally {
    await cleanupFixtures(portfolioId);
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
