import { Hono } from 'hono';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { describe, expect, it, vi } from 'vitest';

import type { AppContext, RpcUser } from '../rpc/middleware/auth';
import { apiErrorHandler } from '../rpc/middleware/error';
import { requestIdMiddleware } from '../rpc/middleware/auth';
import { validationErrorMiddleware } from '../rpc/middleware/validation';
import { mcpRoutes } from './routes';

const services = vi.hoisted(() => ({
  calendarSearch: vi.fn(),
  calendarUpcoming: vi.fn(),
  financeMonthlySummary: vi.fn(),
}));

vi.mock('../application/calendar.service', () => ({
  CalendarService: class {
    search = services.calendarSearch;
    upcoming = services.calendarUpcoming;
  },
}));

vi.mock('../application/finance.service', () => ({
  FinanceService: class {
    monthlySummary = services.financeMonthlySummary;
  },
}));

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

async function createClient(app: Hono<AppContext>, scopes?: string) {
  const transport = new StreamableHTTPClientTransport(new URL('http://localhost/api/mcp'), {
    fetch: async (input, init) => app.fetch(new Request(input, init)),
    requestInit: {
      headers: scopes ? { 'x-mcp-scopes': scopes } : undefined,
    },
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

  it('lists tools and invokes a calendar tool over streamable HTTP', async () => {
    services.calendarSearch.mockResolvedValueOnce([
      {
        occurrenceId: '22222222-2222-4222-8222-222222222222',
        eventId: '33333333-3333-4333-8333-333333333333',
        title: 'Dinner in Nashville',
        startsAt: '2026-03-12T18:00:00.000Z',
        endsAt: '2026-03-12T20:00:00.000Z',
        occurrenceDate: null,
        isAllDay: false,
        location: 'Nashville',
        isCancelled: false,
        evidence: {
          sourceRecordId: '44444444-4444-4444-8444-444444444444',
          sourceSystem: 'calendar-fixture',
          sourceFile: 'march-trip.ics',
          importRunId: '55555555-5555-4555-8555-555555555555',
          importedAt: '2026-07-10T10:00:00.000Z',
        },
      },
    ]);

    const client = await createClient(createApp(true));
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual([
        'personal_calendar_search',
        'personal_calendar_upcoming',
        'personal_finance_monthly_summary',
      ]);

      const result = await client.callTool({
        name: 'personal_calendar_search',
        arguments: {
          query: 'Nashville',
          startsFrom: '2026-03-01T00:00:00.000Z',
          startsBefore: '2026-04-01T00:00:00.000Z',
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        events: [
          {
            title: 'Dinner in Nashville',
            evidence: { sourceFile: 'march-trip.ics' },
          },
        ],
      });
    } finally {
      await client.close();
    }
  });

  it('returns an error result when the caller lacks the required scope', async () => {
    const client = await createClient(createApp(true), 'finance:read');
    try {
      const result = await client.callTool({
        name: 'personal_calendar_search',
        arguments: {
          query: 'Nashville',
        },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0]).toMatchObject({
        type: 'text',
        text: 'Missing required scope(s): calendar:read',
      });
    } finally {
      await client.close();
    }
  });
});
