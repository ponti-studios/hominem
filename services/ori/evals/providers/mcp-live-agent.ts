import type { ApiProvider, CallApiContextParams, ProviderResponse } from 'promptfoo';

import type { McpTrace } from '../lib/mcp-scoring';

// Live MCP agent. The model sees what a real MCP client sees: the server's discovery tools
// (search_tools, get_tool_details, call_read_tool, call_write_tool). Every call runs for real
// against the MCP endpoint, so the outcome is what the server returned, not a fixture. For each
// call_read_tool / call_write_tool, the trace records the underlying tool name, so the grader
// scores the real operation.
//
// Env:
//   HOMINEM_EVAL_MCP_TOKEN  personal MCP token (hmt_...) for the test account. Required.
//   HOMINEM_EVAL_API_URL    default http://localhost:4040. Local loopback or api.lvh.me only.
//   OPENROUTER_API_KEY      model access.

// Discovery costs turns too: search_tools, get_tool_details, then the call itself is about three
// turns per underlying action, so 8 cut off agents that were still making progress.
const MAX_TURNS = 12;
const DEFAULT_API = 'http://localhost:4040';
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', 'api.lvh.me']);
const DISCOVERY = new Set([
  'search_tools',
  'get_tool_details',
  'call_read_tool',
  'call_write_tool',
]);
const UNWRAP = new Set(['call_read_tool', 'call_write_tool']);

type ToolCall = { id?: string; function?: { name?: string; arguments?: string } };
type ChatBody = {
  choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
};
type McpTool = { name: string; description?: string; inputSchema?: unknown };
type ToolResult = {
  content?: Array<{ type?: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
};
type TraceCall = NonNullable<McpTrace['calls']>[number];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function resolveApiBase(raw = process.env.HOMINEM_EVAL_API_URL ?? DEFAULT_API): string {
  const url = new URL(raw);
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(
      `HOMINEM_EVAL_API_URL must be local (localhost, 127.0.0.1, api.lvh.me); got ${url.hostname}`,
    );
  }
  return url.origin;
}

// Streamable-HTTP replies come back as SSE (`data: {...}`) or plain JSON. Accept both.
export function parseRpcBody(text: string): unknown {
  const data = text
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .at(-1);
  return JSON.parse(data ?? text);
}

function rpcError(body: unknown): string | null {
  if (!isRecord(body) || !isRecord(body.error)) return null;
  return typeof body.error.message === 'string' ? body.error.message : 'unknown';
}

export class McpClient {
  private nextId = 1;

  constructor(
    private readonly base: string,
    private readonly token: string,
  ) {}

  async rpc(method: string, params?: unknown): Promise<unknown> {
    const response = await fetch(`${this.base}/api/mcp`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: this.nextId++, method, params }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = parseRpcBody(await response.text());
    const error = rpcError(body);
    if (!response.ok || error) {
      throw new Error(`MCP ${method} failed (${response.status}): ${error ?? 'unknown'}`);
    }
    return isRecord(body) ? body.result : undefined;
  }

  async listDiscoveryTools(): Promise<McpTool[]> {
    const result = await this.rpc('tools/list');
    const tools = isRecord(result) && Array.isArray(result.tools) ? result.tools : [];
    return tools.filter(
      (tool): tool is McpTool =>
        isRecord(tool) && typeof tool.name === 'string' && DISCOVERY.has(tool.name),
    );
  }
}

// Turns an MCP tools/call result into what the model and grader see.
export function toolOutput(result: unknown): {
  output: unknown;
  failed: boolean;
  confirmation: boolean;
} {
  const r: ToolResult = isRecord(result) ? result : {};
  const text = r.content?.find((part) => part.type === 'text')?.text ?? '';
  let output: unknown = r.structuredContent ?? text;
  if (r.structuredContent === undefined && text) {
    try {
      output = JSON.parse(text);
    } catch {
      output = text;
    }
  }
  const status = isRecord(output) && typeof output.status === 'string' ? output.status : undefined;
  const code = isRecord(output) && typeof output.code === 'string' ? output.code : undefined;
  return {
    output,
    failed: r.isError === true,
    // The server signals a gated write with structuredContent.code, not status. Missing this
    // lets the model auto-confirm by retrying with the token, which is the harness's bug, not the
    // user's consent.
    confirmation: code === 'confirmation_required' || status === 'confirmation_required',
  };
}

function parseArguments(raw: string | undefined): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}');
    return isRecord(parsed) ? parsed : {};
  } catch {
    // Malformed arguments reach the server as an empty object, as a client would send them.
    return {};
  }
}

export default class McpLiveAgentProvider implements ApiProvider {
  private readonly model: string;
  private connection: Promise<{ client: McpClient; tools: McpTool[] }> | null = null;

  constructor(options: { config?: { model?: string } } = {}) {
    this.model = options.config?.model ?? 'openai/gpt-5-mini';
  }

  id(): string {
    return `mcp-live-agent:${this.model}`;
  }

  private connect(): Promise<{ client: McpClient; tools: McpTool[] }> {
    this.connection ??= (async () => {
      const token = process.env.HOMINEM_EVAL_MCP_TOKEN;
      if (!token) throw new Error('HOMINEM_EVAL_MCP_TOKEN is required for live MCP evals');
      const client = new McpClient(resolveApiBase(), token);
      return { client, tools: await client.listDiscoveryTools() };
    })();
    return this.connection;
  }

  async callApi(_prompt: string, context?: CallApiContextParams): Promise<ProviderResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { error: 'OPENROUTER_API_KEY is required for MCP evals' };

    let connection: { client: McpClient; tools: McpTool[] };
    try {
      connection = await this.connect();
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
    const { client, tools } = connection;

    const vars = context?.vars ?? {};
    const available = tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description ?? '',
        parameters: tool.inputSchema ?? { type: 'object', properties: {} },
      },
    }));

    const toolCalls: string[] = [];
    const calls: TraceCall[] = [];
    let confirmationRequested: string | undefined;
    const messages: Array<Record<string, unknown>> = [
      ...(vars.systemPrompt ? [{ role: 'system', content: String(vars.systemPrompt) }] : []),
      { role: 'user', content: String(vars.prompt) },
    ];
    const usage = { prompt: 0, completion: 0, total: 0, cost: 0 };
    let text = '';

    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0,
          tools: available,
          usage: { include: true },
        }),
      });
      if (!response.ok) {
        return {
          error: `OpenRouter request failed (${response.status}): ${await response.text()}`,
        };
      }
      const body: ChatBody = await response.json();
      usage.prompt += body.usage?.prompt_tokens ?? 0;
      usage.completion += body.usage?.completion_tokens ?? 0;
      usage.total += body.usage?.total_tokens ?? 0;
      usage.cost += body.usage?.cost ?? 0;

      const message = body.choices?.[0]?.message;
      const modelCalls = message?.tool_calls ?? [];
      const content = message?.content ?? '';
      text += content;
      messages.push({
        role: 'assistant',
        content,
        ...(modelCalls.length ? { tool_calls: modelCalls } : {}),
      });

      let confirmation = false;
      for (const call of modelCalls) {
        const name = call.function?.name ?? 'unknown';
        const input = parseArguments(call.function?.arguments);
        let content: string;
        try {
          const outcome = toolOutput(await client.rpc('tools/call', { name, arguments: input }));
          const underlying = UNWRAP.has(name) && typeof input.name === 'string' ? input.name : null;
          if (underlying) toolCalls.push(underlying);
          calls.push({
            tool: underlying ?? name,
            input,
            output: outcome.output,
            ...(outcome.failed ? { error: 'failed' } : {}),
            status: outcome.confirmation
              ? 'confirmation_required'
              : outcome.failed
                ? 'failed'
                : 'succeeded',
          });
          if (outcome.confirmation) {
            confirmationRequested = underlying ?? name;
            confirmation = true;
          }
          content = JSON.stringify(outcome.output);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          calls.push({
            tool: name,
            input,
            output: { error: message },
            error: message,
            status: 'failed',
          });
          content = JSON.stringify({ error: message });
        }
        if (confirmation) break;
        messages.push({ role: 'tool', tool_call_id: call.id, content });
      }

      if (modelCalls.length === 0 || confirmation) {
        const trace: McpTrace = {
          toolCalls,
          calls,
          text,
          ...(confirmationRequested ? { confirmationRequested } : {}),
        };
        return {
          output: text,
          tokenUsage: { prompt: usage.prompt, completion: usage.completion, total: usage.total },
          cost: usage.cost,
          metadata: { trace, turns: turn + 1 },
        };
      }
    }

    // Not a provider error: the agent ran out of budget, which is a planning failure the
    // trajectory grader scores. Leaving `error` unset keeps it out of the infrastructure count.
    const trace: McpTrace = { toolCalls, calls, text, truncated: true };
    return {
      output: text,
      tokenUsage: { prompt: usage.prompt, completion: usage.completion, total: usage.total },
      cost: usage.cost,
      metadata: { trace, turns: MAX_TURNS, truncated: true },
    };
  }
}
