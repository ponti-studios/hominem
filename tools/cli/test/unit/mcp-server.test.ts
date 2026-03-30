import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import {
  MCP_ERROR_CODES,
  MCP_PROTOCOL_VERSION,
  McpRequestSchema,
  mcpError,
  mcpSuccess,
} from '../../src/services/mcp-server/protocol';

const getStoredTokensMock = mock();

mock.module('@/utils/auth', () => ({
  getStoredTokens: getStoredTokensMock,
}));

const { MCP_TOOLS, callTool } = await import('../../src/services/mcp-server/tools');

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof mock>;

const defaultUser = {
  id: 'user_123',
  email: 'user@example.com',
  name: 'User Example',
  image: 'https://example.com/avatar.png',
  createdAt: '2026-03-30T00:00:00.000Z',
  updatedAt: '2026-03-30T00:00:00.000Z',
};

function createSessionResponse(input?: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  isAuthenticated?: boolean;
  user?: typeof defaultUser | null;
}) {
  const ok = input?.ok ?? true;
  return {
    ok,
    status: input?.status ?? (ok ? 200 : 401),
    statusText: input?.statusText ?? (ok ? 'OK' : 'Unauthorized'),
    json: async () => ({
      isAuthenticated: input?.isAuthenticated ?? ok,
      user: input?.user === undefined ? (ok ? defaultUser : null) : input.user,
    }),
  } as Response;
}

// ---------------------------------------------------------------------------
// Protocol helpers
// ---------------------------------------------------------------------------

describe('MCP protocol', () => {
  test('McpRequestSchema accepts a valid initialize request', () => {
    const raw = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {} },
    };
    const result = McpRequestSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  test('McpRequestSchema rejects a request with the wrong jsonrpc version', () => {
    const raw = { jsonrpc: '1.0', id: 1, method: 'initialize' };
    const result = McpRequestSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });

  test('mcpSuccess builds a valid JSON-RPC success envelope', () => {
    const response = mcpSuccess(42, { ok: true });
    expect(response).toEqual({ jsonrpc: '2.0', id: 42, result: { ok: true } });
  });

  test('mcpError builds a valid JSON-RPC error envelope', () => {
    const response = mcpError('x', MCP_ERROR_CODES.METHOD_NOT_FOUND, 'Method not found: foo');
    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 'x',
      error: { code: -32601, message: 'Method not found: foo' },
    });
  });
});

// ---------------------------------------------------------------------------
// Tool catalogue
// ---------------------------------------------------------------------------

describe('MCP tools catalogue', () => {
  test('exposes exactly the expected tools', () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(names).toContain('ping');
    expect(names).toContain('agent_health');
    expect(names).toContain('current_user');
    expect(names).toContain('offline_retry_config');
    expect(names).toContain('offline_backoff_preview');
  });

  test('every tool has a non-empty description and an object inputSchema', () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  test('offline_backoff_preview declares attempts as a required param', () => {
    const tool = MCP_TOOLS.find((t) => t.name === 'offline_backoff_preview');
    expect(tool?.inputSchema.required).toContain('attempts');
  });
});

// ---------------------------------------------------------------------------
// Tool dispatcher
// ---------------------------------------------------------------------------

describe('callTool', () => {
  beforeEach(() => {
    getStoredTokensMock.mockReset();
    fetchMock = mock();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('ping returns ok=true', async () => {
    const result = await callTool('ping', {});
    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0]!.text) as { ok: boolean };
    expect(payload.ok).toBe(true);
  });

  test('agent_health returns status=ok', async () => {
    const result = await callTool('agent_health', {});
    const payload = JSON.parse(result.content[0]!.text) as { status: string; service: string };
    expect(payload.status).toBe('ok');
    expect(payload.service).toBe('hominem-mcp-server');
  });

  test('current_user returns the authenticated user profile', async () => {
    getStoredTokensMock.mockResolvedValueOnce({
      tokenVersion: 2,
      accessToken: 'stored-bearer',
      issuerBaseUrl: 'http://localhost:4040',
      provider: 'better-auth',
    });
    fetchMock.mockResolvedValueOnce(
      createSessionResponse({
        user: defaultUser,
      }),
    );

    const result = await callTool('current_user', {});

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0]!.text) as {
      authenticated: boolean;
      user: typeof defaultUser;
    };
    expect(payload.authenticated).toBe(true);
    expect(payload.user.email).toBe('user@example.com');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4040/api/auth/session',
      expect.objectContaining({
        method: 'GET',
        headers: {
          authorization: 'Bearer stored-bearer',
        },
      }),
    );
  });

  test('current_user fails when no stored token is available', async () => {
    getStoredTokensMock.mockResolvedValueOnce(null);

    const result = await callTool('current_user', {});

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('No stored auth token found');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('current_user fails when the API rejects the stored token', async () => {
    getStoredTokensMock.mockResolvedValueOnce({
      tokenVersion: 2,
      accessToken: 'expired-token',
      issuerBaseUrl: 'http://localhost:4040',
      provider: 'better-auth',
    });
    fetchMock.mockResolvedValueOnce(
      createSessionResponse({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        isAuthenticated: false,
        user: null,
      }),
    );

    const result = await callTool('current_user', {});

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('API session request failed');
  });

  test('offline_retry_config returns the expected networkMode', async () => {
    const result = await callTool('offline_retry_config', {});
    const payload = JSON.parse(result.content[0]!.text) as { networkMode: string };
    expect(payload.networkMode).toBe('offlineFirst');
  });

  test('offline_retry_config exposes query and chat retry caps', async () => {
    const result = await callTool('offline_retry_config', {});
    const payload = JSON.parse(result.content[0]!.text) as {
      queryRetryMaxMs: number;
      chatRetryMaxMs: number;
    };
    expect(payload.queryRetryMaxMs).toBe(30_000);
    expect(payload.chatRetryMaxMs).toBe(10_000);
  });

  test('offline_backoff_preview returns a schedule with the requested length', async () => {
    const result = await callTool('offline_backoff_preview', { attempts: 4 });
    const schedule = JSON.parse(result.content[0]!.text) as Array<{
      attempt: number;
      queryDelayMs: number;
      chatDelayMs: number;
    }>;
    expect(schedule).toHaveLength(4);
    expect(schedule[0]!.attempt).toBe(1);
  });

  test('offline_backoff_preview caps chat delays at 10 000 ms', async () => {
    const result = await callTool('offline_backoff_preview', { attempts: 10 });
    const schedule = JSON.parse(result.content[0]!.text) as Array<{
      attempt: number;
      chatDelayMs: number;
    }>;
    for (const row of schedule) {
      expect(row.chatDelayMs).toBeLessThanOrEqual(10_000);
    }
  });

  test('offline_backoff_preview caps query delays at 30 000 ms', async () => {
    const result = await callTool('offline_backoff_preview', { attempts: 10 });
    const schedule = JSON.parse(result.content[0]!.text) as Array<{
      attempt: number;
      queryDelayMs: number;
    }>;
    for (const row of schedule) {
      expect(row.queryDelayMs).toBeLessThanOrEqual(30_000);
    }
  });

  test('offline_backoff_preview clamps attempts to 10', async () => {
    const result = await callTool('offline_backoff_preview', { attempts: 100 });
    const schedule = JSON.parse(result.content[0]!.text) as unknown[];
    expect(schedule).toHaveLength(10);
  });

  test('returns isError=true for an unknown tool', async () => {
    const result = await callTool('does_not_exist', {});
    expect(result.isError).toBe(true);
  });
});
