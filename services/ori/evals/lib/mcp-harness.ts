import {
  AgentRuntimeEventTag,
  defineHarness,
  type AgentHarness,
  type AgentRuntimeEvent,
  type HarnessInvokeOptions,
} from 'ori';
import { setupAgent } from 'ori/eval';

import { executeFixtureTool, type McpFixtureProfile, type ToolOutcome } from './mcp-fixtures';
import type { McpTrace } from './mcp-scoring';
import { tools, toolsByDomain, type McpToolDomain } from './mcp-tool-catalog';

type ToolCall = { id?: string; function?: { name?: string; arguments?: string } };
type ToolInput = Record<string, unknown>;
export type { McpToolDomain };

type HarnessOptions = {
  tools?: readonly string[];
  fixture?: McpFixtureProfile;
};

type HarnessState = { calls: string[]; trace: McpTrace; fixture: McpFixtureProfile };

const event = (
  type: AgentRuntimeEventTag,
  payload: Record<string, unknown>,
  model: string,
): AgentRuntimeEvent => ({ type, payload, model, harness: 'hominem-mcp' }) as AgentRuntimeEvent;

function executeTool(name: string, input: ToolInput, state: HarnessState): ToolOutcome {
  const outcome = executeFixtureTool(name, input, state);
  const output = outcome.output as { error?: string };
  state.trace.calls = [
    ...(state.trace.calls ?? []),
    {
      tool: name,
      input,
      output: outcome.output,
      ...(output?.error ? { error: output.error } : {}),
      status: outcome.confirmationRequired
        ? 'confirmation_required'
        : output?.error
          ? 'failed'
          : 'succeeded',
    },
  ];
  if (outcome.confirmationRequired) state.trace.confirmationRequested = name;
  return outcome;
}

export function createMcpHarness(options: HarnessOptions = {}): {
  harness: AgentHarness;
  getTrace: () => McpTrace;
} {
  const availableTools = options.tools
    ? tools.filter((tool) => options.tools?.includes(tool.function.name))
    : tools;
  let trace: McpTrace | undefined;

  const harness: AgentHarness = defineHarness({
    name: 'hominem-mcp',
    init(registrar) {
      registrar.registerPrompt(async function* (invokeOptions: HarnessInvokeOptions) {
        const model = invokeOptions.model ?? process.env.ORI_TARGET_MODEL ?? 'openai/gpt-5-mini';
        const apiKey = invokeOptions.env?.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY;
        if (!apiKey) throw new Error('OPENROUTER_API_KEY is required for MCP evaluation');
        const startedAt = performance.now();
        const messages: Array<Record<string, unknown>> = [
          ...(invokeOptions.systemPrompt
            ? [{ role: 'system', content: invokeOptions.systemPrompt }]
            : []),
          { role: 'user', content: invokeOptions.prompt },
        ];
        const state: HarnessState = {
          calls: [],
          fixture: options.fixture ?? {},
          trace: { toolCalls: [], calls: [] },
        };
        trace = state.trace;

        yield event(
          AgentRuntimeEventTag.RunStarted,
          { prompt: invokeOptions.prompt, model, availableTools: availableTools.length },
          model,
        );
        yield event(AgentRuntimeEventTag.SessionStarted, {}, model);

        for (let turn = 0; turn < 8; turn += 1) {
          const turnStartedAt = performance.now();
          yield event(
            AgentRuntimeEventTag.TurnStarted,
            { prompt: invokeOptions.prompt, turn },
            model,
          );
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              authorization: `Bearer ${apiKey}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ model, messages, temperature: 0, tools: availableTools }),
          });
          if (!response.ok) {
            const detail = await response.text();
            const message = `OpenRouter request failed (${response.status}): ${detail}`;
            state.trace.providerError = true;
            yield event(
              AgentRuntimeEventTag.TurnFailed,
              { failure: { message }, errorCategory: 'provider' },
              model,
            );
            yield event(
              AgentRuntimeEventTag.SessionFailed,
              { failure: { message }, errorCategory: 'provider' },
              model,
            );
            throw new Error(message);
          }
          const body = (await response.json()) as {
            choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
            usage?: Record<string, unknown>;
          };
          const message = body.choices?.[0]?.message;
          const toolCalls = message?.tool_calls ?? [];
          const content = message?.content ?? '';
          if (content) {
            state.trace.text = `${state.trace.text ?? ''}${content}`;
            yield event(AgentRuntimeEventTag.AssistantTextDelta, { delta: content }, model);
          }
          messages.push({
            role: 'assistant',
            content,
            ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
          });
          if (toolCalls.length === 0) {
            state.trace.toolCalls = state.calls;
            yield event(
              AgentRuntimeEventTag.TurnSucceeded,
              { latencyMs: performance.now() - turnStartedAt, usage: body.usage ?? null },
              model,
            );
            yield event(
              AgentRuntimeEventTag.SessionSucceeded,
              {
                latencyMs: performance.now() - startedAt,
                toolCalls: state.calls,
                usage: body.usage ?? null,
              },
              model,
            );
            return;
          }

          for (const call of toolCalls) {
            const name = call.function?.name ?? 'unknown';
            let input: ToolInput;
            try {
              input = JSON.parse(call.function?.arguments ?? '{}') as ToolInput;
            } catch {
              input = {};
            }
            yield event(
              AgentRuntimeEventTag.ToolStarted,
              { name, input, toolCallId: call.id },
              model,
            );
            const outcome = executeTool(name, input, state);
            if (outcome.confirmationRequired) {
              state.trace.toolCalls = state.calls;
              yield event(
                AgentRuntimeEventTag.ConfirmationRequired,
                { name, input, toolCallId: call.id, preview: outcome.output },
                model,
              );
              yield event(
                AgentRuntimeEventTag.SessionSucceeded,
                {
                  pendingConfirmation: name,
                  toolCalls: state.calls,
                  latencyMs: performance.now() - startedAt,
                },
                model,
              );
              return;
            }
            yield event(
              AgentRuntimeEventTag.ToolSucceeded,
              {
                name,
                input,
                output: outcome.output,
                toolCallId: call.id,
                error: Boolean((outcome.output as { error?: string }).error),
              },
              model,
            );
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(outcome.output),
            });
          }
          yield event(
            AgentRuntimeEventTag.TurnSucceeded,
            { latencyMs: performance.now() - turnStartedAt, usage: body.usage ?? null },
            model,
          );
        }

        state.trace.toolCalls = state.calls;
        state.trace.runtimeError = true;
        const message = 'The agent exceeded the allowed MCP interaction budget.';
        yield event(
          AgentRuntimeEventTag.SessionFailed,
          { failure: { message }, errorCategory: 'planning' },
          model,
        );
        throw new Error(message);
      });
    },
  });

  return {
    harness,
    getTrace: () => {
      if (!trace) throw new Error('MCP harness did not produce a trace');
      return trace;
    },
  };
}

export async function runMcpCase({
  model,
  prompt,
  systemPrompt,
  tools: toolNames,
  fixture,
}: {
  model: string;
  prompt: string;
  systemPrompt?: string;
  tools?: readonly string[];
  fixture?: McpFixtureProfile;
}) {
  const configured = createMcpHarness({ tools: toolNames, fixture });
  const agent = setupAgent({ model, harness: configured.harness });
  const run = await agent.run({ prompt, ...(systemPrompt ? { systemPrompt } : {}) });
  return { run, trace: configured.getTrace() };
}

export function toolsForDomains(...domains: McpToolDomain[]): readonly string[] {
  return domains.flatMap((domain) => toolsByDomain[domain].map((tool) => tool.function.name));
}

export const allMcpTools = tools.map((tool) => tool.function.name);
