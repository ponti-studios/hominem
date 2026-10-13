import {
  AgentRuntimeEventTag,
  defineHarness,
  type AgentHarness,
  type AgentRuntimeEvent,
  type HarnessInvokeOptions,
} from 'ori';

import { openRouterError } from './eval-infra';
import type { McpTrace } from './mcp-scoring';
import { addPricedUsage, pricedUsageFromOpenRouter, type PricedUsage } from './openrouter-usage';

type ToolCall = { id?: string; function?: { name?: string; arguments?: string } };
type ToolInput = Record<string, unknown>;
type ToolOutcome = { output: unknown; confirmationRequired?: boolean };

type MockToolDefinition = readonly [string, string, Record<string, unknown>];

const toolDefinitions: MockToolDefinition[] = [
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
];

const mockPlanningTools: Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: { type: 'object'; properties: Record<string, unknown> };
  };
}> = toolDefinitions.map(([name, description, properties]) => ({
  type: 'function',
  function: {
    name,
    description,
    parameters: { type: 'object', properties },
  },
}));

const toolsByDomain: Record<string, readonly unknown[]> = {
  career: mockPlanningTools.filter((tool) => tool.function.name.startsWith('career_')),
  travel: mockPlanningTools.filter((tool) =>
    ['place_visit_history', 'trip_history'].includes(tool.function.name),
  ),
  finance: mockPlanningTools.filter((tool) => tool.function.name.startsWith('finance_')),
  people: mockPlanningTools.filter((tool) =>
    ['people_lookup', 'person_timeline'].includes(tool.function.name),
  ),
  all: mockPlanningTools,
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

const routePrompt = async (
  prompt: string,
  model: string,
  apiKey: string,
): Promise<{ domain: string; usage: PricedUsage }> => {
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
  if (!response.ok) {
    throw openRouterError(response.status, await response.text());
  }
  const body: {
    id?: string | null;
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: { cost?: number | null; total_tokens?: number | null } | null;
  } = await response.json();
  return {
    domain: parseDomain(body.choices?.[0]?.message?.content ?? ''),
    usage: pricedUsageFromOpenRouter(body),
  };
};

const event = (
  type: AgentRuntimeEventTag,
  payload: Record<string, unknown>,
  model: string,
): AgentRuntimeEvent => {
  const record: AgentRuntimeEvent = { type, payload, model, harness: 'hominem-mcp' };
  return record;
};

function isErrorRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function outcomeError(output: unknown): string | undefined {
  if (!isErrorRecord(output)) return undefined;
  const error = output.error;
  return typeof error === 'string' ? error : undefined;
}

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
  const error = outcomeError(outcome.output);
  state.trace.calls = [
    ...(state.trace.calls ?? []),
    {
      tool: name,
      input,
      output: outcome.output,
      ...(error === undefined ? {} : { error }),
      status: outcome.confirmationRequired
        ? 'confirmation_required'
        : error
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
      const routed = routing
        ? await routePrompt(options.prompt, routerModel, apiKey).catch(() => ({
            domain: 'all',
            usage: {},
          }))
        : { domain: 'all', usage: {} };
      const domain = routed.domain;
      let usage: PricedUsage = routed.usage;
      const availableTools = toolsByDomain[domain] ?? mockPlanningTools;
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
          const failure = openRouterError(response.status, await response.text());
          yield event(
            AgentRuntimeEventTag.TurnFailed,
            { failure: { message: failure.message }, errorCategory: 'provider' },
            model,
          );
          yield event(
            AgentRuntimeEventTag.SessionFailed,
            { failure: { message: failure.message }, errorCategory: 'provider', usage },
            model,
          );
          throw failure;
        }
        const body: {
          id?: string | null;
          choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
          usage?: { cost?: number | null; total_tokens?: number | null } | null;
        } = await response.json();
        // Ori prices a run from cumulative usage.costUsd on its terminal event.
        // Include router and prior turns, not only the successful final turn.
        usage = addPricedUsage(usage, pricedUsageFromOpenRouter(body));
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
            { latencyMs: performance.now() - turnStartedAt, usage },
            model,
          );
          yield event(
            AgentRuntimeEventTag.SessionSucceeded,
            {
              latencyMs: performance.now() - startedAt,
              toolCalls: state.calls,
              usage,
            },
            model,
          );
          return;
        }
        for (const call of toolCalls) {
          const name = call.function?.name ?? 'unknown';
          let input: ToolInput;
          try {
            input = JSON.parse(call.function?.arguments ?? '{}');
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
                usage,
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
              error: outcomeError(outcome.output) !== undefined,
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
          { latencyMs: performance.now() - turnStartedAt, usage },
          model,
        );
      }
      yield event(
        AgentRuntimeEventTag.SessionFailed,
        {
          failure: { message: 'The agent exceeded the allowed MCP interaction budget.' },
          errorCategory: 'planning',
          usage,
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
