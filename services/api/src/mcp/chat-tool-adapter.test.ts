import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const mocks = vi.hoisted(() => ({
  createStructuredChatCompletion: vi.fn(),
  getModelCapabilityProfile: vi.fn(),
}));

vi.mock('@hominem/ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@hominem/ai')>()),
  createStructuredChatCompletion: mocks.createStructuredChatCompletion,
  getModelCapabilityProfile: mocks.getModelCapabilityProfile,
}));

// Tools are registered by hand below; the real loader imports every tool module
// (and through them the database layer).
vi.mock('./register-tools', () => ({ ensureMcpToolsRegistered: async () => undefined }));

import { logger } from '@hominem/telemetry';

import type { CapabilityDefinition } from '../application/capability';
import { chatToolName } from '../chat/chat-tool-name';
import { planChatTools } from './chat-tool-adapter';
import { registerTool } from './tool-registry';

const empty = z.object({});

function register(
  name: string,
  scope: 'task' | 'notes' | 'memory' | 'finance',
  access: 'read' | 'write',
  guidance?: { dependsOn: string },
) {
  const definition: CapabilityDefinition = {
    name,
    title: name,
    description: name,
    inputSchema: empty,
    outputSchema: empty,
    readOnly: access === 'read',
    scopes: [`${scope}:${access}`],
    resultCap: 10,
    ...(access === 'write' ? { destructive: false, idempotent: false } : {}),
    ...(guidance
      ? {
          guidance: {
            whenToUse: name,
            whenNotToUse: name,
            dependencies: [{ tool: guidance.dependsOn, reason: 'resolve id', provides: ['id'] }],
          },
        }
      : {}),
  };
  registerTool(definition, async () => ({}));
}

beforeAll(() => {
  register('task_list', 'task', 'read');
  register('task_create', 'task', 'write');
  register('task_update', 'task', 'write', { dependsOn: 'task_list' });
  register('notes_search', 'notes', 'read');
  register('memory_search', 'memory', 'read');
  register('finance_transactions', 'finance', 'read');
});

const toolNames = (tools: Awaited<ReturnType<typeof planChatTools>>['tools']) =>
  tools.map(chatToolName);

const userSays = (content: string) => [{ role: 'user' as const, content }];
const ADD_TASK = userSays('add a task to setup google home for my new living room lights');
const SPENDING = userSays('how much did I spend last month?');

type Route = { capabilities?: string[]; requiresLookup?: boolean; requiresWebSearch?: boolean };
const routerSays = ({
  capabilities = [],
  requiresLookup = false,
  requiresWebSearch = false,
}: Route) =>
  mocks.createStructuredChatCompletion.mockResolvedValueOnce({
    output: { capabilities, requiresLookup, requiresWebSearch },
    usage: null,
  });
const plannerSays = (tools: string[]) =>
  mocks.createStructuredChatCompletion.mockResolvedValueOnce({
    output: { steps: tools.map((tool) => ({ tool, purpose: 'Find spending', dependsOn: [] })) },
    usage: null,
  });
const plan = (messages: Parameters<typeof planChatTools>[0]['messages']) =>
  planChatTools({ model: 'test-model', messages });

// Regression: the router classified "add a task..." as not needing a lookup, so the
// model was given no tools at all and replied "let me check your tasks..." without
// ever calling one.
describe('planChatTools core tools', () => {
  beforeEach(() => {
    mocks.createStructuredChatCompletion.mockReset();
    mocks.getModelCapabilityProfile.mockReturnValue({ structuredPlanning: true });
  });

  it('exposes and schedules the core tools when the router says no lookup is required', async () => {
    routerSays({});

    const planned = await plan(ADD_TASK);

    expect(planned.requiresLookup).toBe(false);
    expect(toolNames(planned.tools)).toEqual(
      expect.arrayContaining(['task_list', 'task_create', 'task_update']),
    );
    expect(toolNames(planned.tools)).not.toContain('finance_transactions');
    // The engine rejects any tool call that is not a planned step, so the tools must be
    // scheduled as well as exposed, with every prerequisite of a scheduled tool.
    const scheduled = new Set(planned.steps.map((step) => step.tool));
    expect([...scheduled]).toEqual(
      expect.arrayContaining(['task_list', 'task_create', 'task_update']),
    );
    for (const step of planned.steps) {
      for (const dependency of step.dependsOn) expect(scheduled).toContain(dependency);
    }
  });

  it('keeps web search alongside the core tools', async () => {
    routerSays({ requiresWebSearch: true });

    expect(toolNames((await plan(ADD_TASK)).tools)).toEqual(
      expect.arrayContaining(['task_create', 'openrouter:web_search']),
    );
  });

  it('adds the core tools to a routed lookup plan instead of replacing them', async () => {
    routerSays({ capabilities: ['finance'], requiresLookup: true });
    plannerSays(['finance_transactions']);

    const planned = await plan(SPENDING);

    expect(planned.requiresLookup).toBe(true);
    expect(toolNames(planned.tools)).toEqual(
      expect.arrayContaining(['finance_transactions', 'task_list', 'task_create']),
    );
    expect(planned.steps[0]?.tool).toBe('finance_transactions');
  });

  it('exposes the core tools on the keyword fallback path too', async () => {
    mocks.getModelCapabilityProfile.mockReturnValue({ structuredPlanning: false });

    const planned = await planChatTools({
      model: 'muse',
      messages: userSays('pick up milk on the way home'),
    });

    expect(planned.requiresLookup).toBe(false);
    expect(toolNames(planned.tools)).toEqual(
      expect.arrayContaining(['task_list', 'task_create', 'notes_search', 'memory_search']),
    );
    expect(mocks.createStructuredChatCompletion).not.toHaveBeenCalled();
  });

  // docs/observability.md: no provider response bodies in exported telemetry. A provider error
  // carries one in its message, so only its class and status may be logged.
  it('logs only the class and status of a provider error when the plan request fails', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    class ProviderError extends Error {
      status = 400;
    }
    routerSays({ capabilities: ['finance'], requiresLookup: true });
    mocks.createStructuredChatCompletion.mockRejectedValueOnce(
      new ProviderError('body: secret schema detail from provider'),
    );

    await plan(SPENDING);

    const fallback = warn.mock.calls.find(
      ([event]) => event === 'chat_tool_plan_validation_failed',
    );
    expect(fallback?.[1]).toMatchObject({ reason: 'Error', status: 400, fallbackUsed: true });
    expect(JSON.stringify(fallback?.[1])).not.toContain('secret schema detail');
    warn.mockRestore();
  });
});
