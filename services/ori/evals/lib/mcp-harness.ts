import {
  AgentRuntimeEventTag,
  defineHarness,
  type AgentHarness,
  type AgentRuntimeEvent,
  type HarnessInvokeOptions,
} from 'ori';

import type { McpTrace } from './mcp-scoring';

type ToolCall = { id?: string; function?: { name?: string; arguments?: string } };
type ToolInput = Record<string, unknown>;
type ToolOutcome = { output: unknown; confirmationRequired?: boolean };

const tools = [
  [
    'place_visit_history',
    'Lists visits to places, not flights or trips.',
    { limit: { type: 'integer' } },
  ],
  [
    'trip_history',
    'Lists trips with stable IDs and normalized start and end dates.',
    { from: { type: 'string' }, to: { type: 'string' } },
  ],
  [
    'people_lookup',
    'Resolves a person name to a stable person ID. Never invent IDs.',
    { query: { type: 'string' } },
  ],
  [
    'person_timeline',
    'Loads a timeline using the personId returned by people_lookup.',
    { personId: { type: 'string' } },
  ],
  [
    'finance_recent_transactions',
    'Lists transactions in a bounded range using dates returned by trip_history.',
    { from: { type: 'string' }, to: { type: 'string' }, limit: { type: 'integer' } },
  ],
  [
    'search_memories',
    'Searches personal memories before a conditional memory write.',
    { query: { type: 'string' } },
  ],
  [
    'remember',
    'Saves one durable personal fact without duplicating an existing memory.',
    { content: { type: 'string' }, title: { type: 'string' } },
  ],
  [
    'list_collections',
    'Lists collections and stable collection IDs before collection writes.',
    { limit: { type: 'integer' } },
  ],
  ['create_collection', 'Creates a collection after confirmation.', { name: { type: 'string' } }],
  [
    'invite_member',
    'Invites a collaborator and requires confirmation immediately before execution.',
    { collectionId: { type: 'string' }, email: { type: 'string' } },
  ],
  [
    'career_applications',
    'Finds career applications and returns stable application IDs.',
    { limit: { type: 'integer' } },
  ],
  [
    'career_application_delete',
    'Deletes an application by ID and requires confirmation.',
    { id: { type: 'string' } },
  ],
  [
    'remove_collection_item',
    'Removes an entity by stable IDs and requires confirmation.',
    { collectionId: { type: 'string' }, entityId: { type: 'string' } },
  ],
  ['career_profile', 'Retrieves current career profile, roles, and skills.', {}],
].map(([name, description, properties]) => ({
  type: 'function' as const,
  function: {
    name: name as string,
    description: description as string,
    parameters: { type: 'object', properties },
  },
}));

const toolsByDomain: Record<string, readonly unknown[]> = {
  career: tools.filter((tool) => tool.function.name.startsWith('career_')),
  travel: tools.filter((tool) =>
    ['place_visit_history', 'trip_history'].includes(tool.function.name),
  ),
  finance: tools.filter((tool) => tool.function.name.startsWith('finance_')),
  people: tools.filter((tool) => ['people_lookup', 'person_timeline'].includes(tool.function.name)),
  all: tools,
  general: [],
};

type HarnessState = { calls: string[]; prompt: string; trace: McpTrace };

let latestTrace: McpTrace | null = null;

export function getLastMcpTrace(): McpTrace {
  if (!latestTrace) throw new Error('MCP harness did not produce a trace');
  return latestTrace;
}

const parseDomain = (content: string): string => {
  const match = content.match(/\{[\s\S]*?"domain"\s*:\s*"([^"]+)"[\s\S]*?\}/i);
  return match?.[1]?.toLowerCase() ?? 'all';
};

const routePrompt = async (prompt: string, model: string, apiKey: string): Promise<string> => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Return only JSON {"domain":"career|travel|finance|people|all|general"}. Use all for multi-domain requests.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
    }),
  });
  if (!response.ok) return 'all';
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return parseDomain(body.choices?.[0]?.message?.content ?? '');
};

const event = (
  type: AgentRuntimeEventTag,
  payload: Record<string, unknown>,
  model: string,
): AgentRuntimeEvent => ({ type, payload, model, harness: 'hominem-mcp' }) as AgentRuntimeEvent;

function executeToolInternal(name: string, input: ToolInput, state: HarnessState): ToolOutcome {
  if (state.calls.includes(name)) return { output: { error: 'duplicate_tool_call', name } };
  state.calls.push(name);
  switch (name) {
    case 'place_visit_history':
      return {
        output: { visits: [{ id: 'visit-1', place: 'Sushi Dai', city: 'Tokyo' }], count: 1 },
      };
    case 'trip_history':
      return {
        output: {
          trips: [
            {
              id: 'trip-tokyo',
              city: 'Tokyo',
              country: 'Japan',
              startDate: '2025-04-10',
              endDate: '2025-04-18',
            },
            {
              id: 'trip-london',
              city: 'London',
              country: 'United Kingdom',
              startDate: '2024-09-02',
              endDate: '2024-09-08',
            },
          ],
          count: 2,
        },
      };
    case 'people_lookup':
      return {
        output: {
          people:
            state.prompt === 'What do I know about Alex?'
              ? [
                  { id: 'person-alex', name: 'Alex Morgan', email: 'alex@example.com' },
                  { id: 'person-alexis', name: 'Alexis Chen', email: 'alexis@example.com' },
                ]
              : [{ id: 'person-alex', name: 'Alex Morgan', email: 'alex@example.com' }],
          count: state.prompt === 'What do I know about Alex?' ? 2 : 1,
        },
      };
    case 'person_timeline':
      return {
        output:
          input.personId === 'person-alex'
            ? { personId: 'person-alex', events: [{ type: 'trip', city: 'Tokyo' }] }
            : { error: 'invalid_or_invented_person_id' },
      };
    case 'finance_recent_transactions':
      return {
        output:
          input.from === '2025-04-10' && input.to === '2025-04-18'
            ? {
                transactions: [
                  { id: 'txn-1', postedOn: '2025-04-12', merchant: 'Sushi Dai', amountCents: 4200 },
                ],
                count: 1,
              }
            : { error: 'date_range_must_come_from_trip_history' },
      };
    case 'search_memories':
      return { output: { memories: [], count: 0 } };
    case 'remember':
      return { output: { id: 'memory-aisle', content: input.content, alreadyExists: false } };
    case 'list_collections':
      return {
        output: {
          collections:
            state.prompt.includes('invite Alex') || state.prompt.includes('Remove Alex')
              ? [{ id: 'collection-japan', name: 'Japan restaurants' }]
              : [{ id: 'collection-existing', name: 'Existing Places' }],
          count: 1,
        },
      };
    case 'career_profile':
      return {
        output: {
          roles: [{ title: 'Staff Engineer', company: 'Hominem' }],
          skills: ['TypeScript'],
        },
      };
    case 'career_applications':
      return {
        output: {
          applications: [
            { id: 'application-old', company: 'Acme', title: 'Engineer', status: 'APPLIED' },
          ],
          count: 1,
        },
      };
    case 'create_collection':
    case 'invite_member':
    case 'career_application_delete':
    case 'remove_collection_item':
      return {
        output: { confirmationRequired: true, pendingAction: name },
        confirmationRequired: true,
      };
    default:
      return { output: { error: `unknown_tool:${name}` } };
  }
}

function executeTool(name: string, input: ToolInput, state: HarnessState): ToolOutcome {
  const outcome = executeToolInternal(name, input, state);
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

const mcpHarness: AgentHarness = defineHarness({
  name: 'hominem-mcp',
  init(registrar) {
    registrar.registerPrompt(async function* (options: HarnessInvokeOptions) {
      const model = options.model ?? process.env.ORI_TARGET_MODEL ?? 'openai/gpt-5-mini';
      const routerModel = process.env.ORI_MCP_ROUTER_MODEL?.trim() || model;
      const apiKey = options.env?.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('OPENROUTER_API_KEY is required for MCP evaluation');
      const startedAt = performance.now();
      const routing = process.env.ORI_MCP_ROUTER !== '0';
      const domain = routing
        ? await routePrompt(options.prompt, routerModel, apiKey).catch(() => 'all')
        : 'all';
      const availableTools = toolsByDomain[domain] ?? tools;
      const messages: Array<Record<string, unknown>> = [
        ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
        { role: 'user', content: options.prompt },
      ];
      const state: HarnessState = {
        calls: [],
        prompt: options.prompt,
        trace: { toolCalls: [], calls: [] },
      };
      yield event(
        AgentRuntimeEventTag.RunStarted,
        {
          prompt: options.prompt,
          model,
          routerModel: routing ? routerModel : null,
          toolDomain: domain,
          benchmarkVersion: 'capability-first-v2',
        },
        model,
      );
      yield event(AgentRuntimeEventTag.SessionStarted, {}, model);
      for (let turn = 0; turn < 8; turn += 1) {
        const turnStartedAt = performance.now();
        yield event(AgentRuntimeEventTag.TurnStarted, { prompt: options.prompt, turn }, model);
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model, messages, temperature: 0, tools: availableTools }),
        });
        if (!response.ok) {
          const detail = await response.text();
          const message = `OpenRouter request failed (${response.status}): ${detail}`;
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
        if (content) state.trace.text = `${state.trace.text ?? ''}${content}`;
        if (content)
          yield event(AgentRuntimeEventTag.AssistantTextDelta, { delta: content }, model);
        messages.push({
          role: 'assistant',
          content,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        });
        if (toolCalls.length === 0) {
          state.trace.toolCalls = state.calls;
          latestTrace = state.trace;
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
            latestTrace = state.trace;
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
      yield event(
        AgentRuntimeEventTag.SessionFailed,
        {
          failure: { message: 'The agent exceeded the allowed MCP interaction budget.' },
          errorCategory: 'planning',
        },
        model,
      );
      state.trace.toolCalls = state.calls;
      state.trace.runtimeError = true;
      latestTrace = state.trace;
      throw new Error('The agent exceeded the allowed MCP interaction budget.');
    });
  },
});

export default mcpHarness;
