import { z } from 'zod';

import { getHominemAccessToken, hominemApiUrl } from './hominem-auth.js';

const responseSchema = z.object({
  error: z.object({ message: z.string().optional() }).optional(),
  result: z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.unknown().optional(),
    })
    .optional(),
});

export interface HominemConfig {
  url?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class HominemMcpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HominemMcpError';
  }
}

export class HominemMcp {
  private readonly cfg: HominemConfig;
  private sessionId: string | null = null;
  private nextId = 1;
  private initialized = false;

  constructor(cfg: HominemConfig = {}) {
    this.cfg = cfg;
  }

  private async post(body: Record<string, unknown>) {
    const token = this.cfg.token ?? (await getHominemAccessToken()).access_token;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
    };
    if (this.sessionId) headers['mcp-session-id'] = this.sessionId;
    const response = await (this.cfg.fetchImpl ?? fetch)(
      this.cfg.url ?? `${hominemApiUrl()}/api/mcp`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.cfg.timeoutMs ?? 300_000),
        redirect: 'error',
      },
    );
    if (!response.ok)
      throw new HominemMcpError(`Hominem request failed (HTTP ${response.status}).`);
    this.sessionId = response.headers.get('mcp-session-id') ?? this.sessionId;
    if (response.status === 202 || response.status === 204) return null;
    const text = await response.text();
    const data = (response.headers.get('content-type') ?? '').includes('text/event-stream')
      ? text
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .at(-1)
          ?.slice(5)
          .trim()
      : text;
    if (!data) throw new HominemMcpError('Hominem returned an empty MCP response.');
    const parsed = responseSchema.parse(JSON.parse(data));
    if (parsed.error)
      throw new HominemMcpError(parsed.error.message ?? 'Hominem MCP request failed.');
    return parsed.result ?? null;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await this.post({
      jsonrpc: '2.0',
      id: this.nextId++,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'hominem-wealth-sync', version: '1.0.0' },
      },
    });
    await this.post({ jsonrpc: '2.0', method: 'notifications/initialized' });
    this.initialized = true;
  }

  async call(tool: string, args: Record<string, unknown>): Promise<unknown> {
    await this.ensureInitialized();
    const result = await this.post({
      jsonrpc: '2.0',
      id: this.nextId++,
      method: 'tools/call',
      params: { name: tool, arguments: args },
    });
    if (!result) throw new HominemMcpError('Hominem returned no tool result.');
    if (result.isError) {
      const failure = z
        .object({ message: z.string().optional() })
        .safeParse(result.structuredContent);
      throw new HominemMcpError(
        failure.success ? (failure.data.message ?? 'Tool failed.') : 'Tool failed.',
      );
    }
    return result.structuredContent;
  }
}
