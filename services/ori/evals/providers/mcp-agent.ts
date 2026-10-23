import type { ApiProvider, CallApiContextParams, ProviderResponse } from 'promptfoo';

import { executeFixtureTool, type McpFixtureProfile } from '../lib/mcp-fixtures';
import type { McpTrace } from '../lib/mcp-scoring';
import { tools } from '../lib/mcp-tool-catalog';

type ToolCall = { id?: string; function?: { name?: string; arguments?: string } };
type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
};

const MAX_TURNS = 8;

/**
 * A small tool-calling agent loop over OpenRouter. Tools are answered from fixtures, so the
 * run is a pure test of the model's tool choice and ordering. The full trajectory comes back
 * in `metadata.trace` for the deterministic grader.
 *
 * Case vars: `prompt`, optional `systemPrompt`, comma-joined `toolNames` and `fixture`.
 */
export default class McpAgentProvider implements ApiProvider {
  private readonly model: string;

  constructor(options: { config?: { model?: string } } = {}) {
    this.model = options.config?.model ?? 'openai/gpt-5-mini';
  }

  id(): string {
    return `mcp-agent:${this.model}`;
  }

  async callApi(_prompt: string, context?: CallApiContextParams): Promise<ProviderResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { error: 'OPENROUTER_API_KEY is required for MCP evals' };
    const vars = context?.vars ?? {};
    // promptfoo expands array vars into extra test cases, so tool names arrive comma-joined.
    const toolNames =
      typeof vars.toolNames === 'string' ? vars.toolNames.split(',').filter(Boolean) : undefined;
    const available = toolNames
      ? tools.filter((tool) => toolNames.includes(tool.function.name))
      : tools;
    const state = {
      calls: [] as string[],
      fixture: (vars.fixture ?? {}) as McpFixtureProfile,
    };
    const trace: McpTrace = { toolCalls: [], calls: [] };
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
      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
        usage?: Usage;
      };
      usage.prompt += body.usage?.prompt_tokens ?? 0;
      usage.completion += body.usage?.completion_tokens ?? 0;
      usage.total += body.usage?.total_tokens ?? 0;
      usage.cost += body.usage?.cost ?? 0;

      const message = body.choices?.[0]?.message;
      const toolCalls = message?.tool_calls ?? [];
      const content = message?.content ?? '';
      text += content;
      messages.push({
        role: 'assistant',
        content,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      });

      let confirmation = false;
      for (const call of toolCalls) {
        const name = call.function?.name ?? 'unknown';
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(call.function?.arguments ?? '{}') as Record<string, unknown>;
        } catch {
          // A model that sends malformed arguments gets an empty input, like production.
        }
        const outcome = executeFixtureTool(name, input, state);
        const error = (outcome.output as { error?: string } | null)?.error;
        trace.calls = [
          ...(trace.calls ?? []),
          {
            tool: name,
            input,
            output: outcome.output,
            ...(error ? { error } : {}),
            status: outcome.confirmationRequired
              ? 'confirmation_required'
              : error
                ? 'failed'
                : 'succeeded',
          },
        ];
        if (outcome.confirmationRequired) {
          trace.confirmationRequested = name;
          confirmation = true;
          break;
        }
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(outcome.output),
        });
      }
      if (toolCalls.length === 0 || confirmation) {
        trace.toolCalls = state.calls;
        trace.text = text;
        return {
          output: text,
          tokenUsage: { prompt: usage.prompt, completion: usage.completion, total: usage.total },
          cost: usage.cost,
          metadata: { trace, turns: turn + 1 },
        };
      }
    }
    trace.toolCalls = state.calls;
    trace.runtimeError = true;
    return { error: 'The agent exceeded the allowed MCP interaction budget.', metadata: { trace } };
  }
}
