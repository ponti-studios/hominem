import { describe, expect, it } from 'bun:test';

import {
  MCP_ERROR_CODES,
  MCP_PROTOCOL_VERSION,
  McpRequestSchema,
  mcpError,
  mcpSuccess,
} from '../../src/services/mcp-server/protocol';
import { MCP_TOOLS, callTool } from '../../src/services/mcp-server/tools';

// ---------------------------------------------------------------------------
// Protocol helpers
// ---------------------------------------------------------------------------

describe('MCP protocol', () => {
  it('McpRequestSchema accepts a valid initialize request', () => {
    const raw = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {} },
    };
    const result = McpRequestSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  it('McpRequestSchema rejects a request with the wrong jsonrpc version', () => {
    const raw = { jsonrpc: '1.0', id: 1, method: 'initialize' };
    const result = McpRequestSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });

  it('mcpSuccess builds a valid JSON-RPC success envelope', () => {
    const response = mcpSuccess(42, { ok: true });
    expect(response).toEqual({ jsonrpc: '2.0', id: 42, result: { ok: true } });
  });

  it('mcpError builds a valid JSON-RPC error envelope', () => {
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
  it('exposes exactly the expected tools', () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(names).toContain('ping');
    expect(names).toContain('agent_health');
    expect(names).toContain('offline_retry_config');
    expect(names).toContain('offline_backoff_preview');
  });

  it('every tool has a non-empty description and an object inputSchema', () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('offline_backoff_preview declares attempts as a required param', () => {
    const tool = MCP_TOOLS.find((t) => t.name === 'offline_backoff_preview');
    expect(tool?.inputSchema.required).toContain('attempts');
  });
});

// ---------------------------------------------------------------------------
// Tool dispatcher
// ---------------------------------------------------------------------------

describe('callTool', () => {
  it('ping returns ok=true', () => {
    const result = callTool('ping', {});
    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0]!.text) as { ok: boolean };
    expect(payload.ok).toBe(true);
  });

  it('agent_health returns status=ok', () => {
    const result = callTool('agent_health', {});
    const payload = JSON.parse(result.content[0]!.text) as { status: string; service: string };
    expect(payload.status).toBe('ok');
    expect(payload.service).toBe('hominem-mcp-server');
  });

  it('offline_retry_config returns the expected networkMode', () => {
    const result = callTool('offline_retry_config', {});
    const payload = JSON.parse(result.content[0]!.text) as { networkMode: string };
    expect(payload.networkMode).toBe('offlineFirst');
  });

  it('offline_retry_config exposes query and chat retry caps', () => {
    const result = callTool('offline_retry_config', {});
    const payload = JSON.parse(result.content[0]!.text) as {
      queryRetryMaxMs: number;
      chatRetryMaxMs: number;
    };
    expect(payload.queryRetryMaxMs).toBe(30_000);
    expect(payload.chatRetryMaxMs).toBe(10_000);
  });

  it('offline_backoff_preview returns a schedule with the requested length', () => {
    const result = callTool('offline_backoff_preview', { attempts: 4 });
    const schedule = JSON.parse(result.content[0]!.text) as Array<{
      attempt: number;
      queryDelayMs: number;
      chatDelayMs: number;
    }>;
    expect(schedule).toHaveLength(4);
    expect(schedule[0]!.attempt).toBe(1);
  });

  it('offline_backoff_preview caps chat delays at 10 000 ms', () => {
    const result = callTool('offline_backoff_preview', { attempts: 10 });
    const schedule = JSON.parse(result.content[0]!.text) as Array<{
      attempt: number;
      chatDelayMs: number;
    }>;
    for (const row of schedule) {
      expect(row.chatDelayMs).toBeLessThanOrEqual(10_000);
    }
  });

  it('offline_backoff_preview caps query delays at 30 000 ms', () => {
    const result = callTool('offline_backoff_preview', { attempts: 10 });
    const schedule = JSON.parse(result.content[0]!.text) as Array<{
      attempt: number;
      queryDelayMs: number;
    }>;
    for (const row of schedule) {
      expect(row.queryDelayMs).toBeLessThanOrEqual(30_000);
    }
  });

  it('offline_backoff_preview clamps attempts to 10', () => {
    const result = callTool('offline_backoff_preview', { attempts: 100 });
    const schedule = JSON.parse(result.content[0]!.text) as unknown[];
    expect(schedule).toHaveLength(10);
  });

  it('returns isError=true for an unknown tool', () => {
    const result = callTool('does_not_exist', {});
    expect(result.isError).toBe(true);
  });
});
