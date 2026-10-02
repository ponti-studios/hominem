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

import { planChatTools } from './chat-tool-adapter';
import { registerTool } from './tool-registry';

const empty = z.object({});

function register(
  name: string,
  scope: 'task' | 'notes' | 'memory' | 'finance',
  access: 'read' | 'write',
  guidance?: { dependsOn: string },
) {
  registerTool(
    {
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
    } as Parameters<typeof registerTool>[0],
    async () => ({}),
  );
}

beforeAll(() => {
  register('task_list', 'task', 'read');
  register('task_create', 'task', 'write');
  register('task_update', 'task', 'write', { dependsOn: 'task_list' });
  register('notes_search', 'notes', 'read');
  register('memory_search', 'memory', 'read');
  register('finance_transactions', 'finance', 'read');
});

function toolNames(tools: Awaited<ReturnType<typeof planChatTools>>['tools']) {
  return tools.map((tool) => ('function' in tool ? tool.function.name : tool.type));
}

const ADD_TASK_MESSAGES = [
  {
    role: 'user' as const,
    content: 'add a task to setup google home for my new living room lights',
  },
];

// Regression: the router classified "add a task..." as not needing a lookup, so the
// model was given no tools at all and replied "let me check your tasks..." without
// ever calling one.
describe('planChatTools core tools', () => {
  beforeEach(() => {
    mocks.createStructuredChatCompletion.mockReset();
    mocks.getModelCapabilityProfile.mockReturnValue({ structuredPlanning: true });
  });

  it('still exposes task tools when the router says no lookup is required', async () => {
    mocks.createStructuredChatCompletion.mockResolvedValueOnce({
      output: { capabilities: [], requiresLookup: false, requiresWebSearch: false },
      usage: null,
    });

    const plan = await planChatTools({ model: 'test-model', messages: ADD_TASK_MESSAGES });

    expect(plan.requiresLookup).toBe(false);
    expect(toolNames(plan.tools)).toEqual(
      expect.arrayContaining(['task_list', 'task_create', 'task_update']),
    );
    // The engine rejects any tool call that is not a planned step, so the tools
    // must be scheduled as well as exposed.
    expect(plan.steps.map((step) => step.tool)).toEqual(
      expect.arrayContaining(['task_list', 'task_create', 'task_update']),
    );
  });

  it('does not expose non-core private tools the router did not select', async () => {
    mocks.createStructuredChatCompletion.mockResolvedValueOnce({
      output: { capabilities: [], requiresLookup: false, requiresWebSearch: false },
      usage: null,
    });

    const plan = await planChatTools({ model: 'test-model', messages: ADD_TASK_MESSAGES });

    expect(toolNames(plan.tools)).not.toContain('finance_transactions');
  });

  it('keeps web search alongside the core tools', async () => {
    mocks.createStructuredChatCompletion.mockResolvedValueOnce({
      output: { capabilities: [], requiresLookup: false, requiresWebSearch: true },
      usage: null,
    });

    const plan = await planChatTools({ model: 'test-model', messages: ADD_TASK_MESSAGES });

    expect(toolNames(plan.tools)).toEqual(
      expect.arrayContaining(['task_create', 'openrouter:web_search']),
    );
  });

  it('adds the core tools to a routed lookup plan instead of replacing them', async () => {
    mocks.createStructuredChatCompletion
      .mockResolvedValueOnce({
        output: { capabilities: ['finance'], requiresLookup: true, requiresWebSearch: false },
        usage: null,
      })
      .mockResolvedValueOnce({
        output: {
          requiresLookup: true,
          steps: [
            {
              tool: 'finance_transactions',
              purpose: 'Find spending',
              dependsOn: [],
              arguments: {},
            },
          ],
        },
        usage: null,
      });

    const plan = await planChatTools({
      model: 'test-model',
      messages: [{ role: 'user', content: 'how much did I spend last month?' }],
    });

    expect(plan.requiresLookup).toBe(true);
    expect(toolNames(plan.tools)).toEqual(
      expect.arrayContaining(['finance_transactions', 'task_list', 'task_create']),
    );
    expect(plan.steps[0]?.tool).toBe('finance_transactions');
  });

  it('exposes the core tools on the keyword fallback path too', async () => {
    mocks.getModelCapabilityProfile.mockReturnValue({ structuredPlanning: false });

    const plan = await planChatTools({
      model: 'muse',
      messages: [{ role: 'user', content: 'pick up milk on the way home' }],
    });

    expect(plan.requiresLookup).toBe(false);
    expect(toolNames(plan.tools)).toEqual(
      expect.arrayContaining(['task_list', 'task_create', 'notes_search', 'memory_search']),
    );
    expect(mocks.createStructuredChatCompletion).not.toHaveBeenCalled();
  });

  it('schedules every prerequisite of a core tool', async () => {
    mocks.createStructuredChatCompletion.mockResolvedValueOnce({
      output: { capabilities: [], requiresLookup: false, requiresWebSearch: false },
      usage: null,
    });

    const plan = await planChatTools({ model: 'test-model', messages: ADD_TASK_MESSAGES });

    const scheduled = new Set(plan.steps.map((step) => step.tool));
    for (const step of plan.steps) {
      for (const dependency of step.dependsOn) expect(scheduled).toContain(dependency);
    }
  });

  it('tells the router that creating or changing saved data needs a lookup', async () => {
    mocks.createStructuredChatCompletion.mockResolvedValueOnce({
      output: { capabilities: [], requiresLookup: false, requiresWebSearch: false },
      usage: null,
    });

    await planChatTools({ model: 'test-model', messages: ADD_TASK_MESSAGES });

    const [{ messages }] = mocks.createStructuredChatCompletion.mock.calls[0] ?? [{ messages: [] }];
    const routingPrompt = messages.find((message: { role: string }) => message.role === 'system');
    expect(routingPrompt?.content).toMatch(/creating, updating, completing, or deleting a record/);
    expect(routingPrompt?.content).toMatch(/"Add a task"/);
  });

  // Regression: the plan model answered requiresLookup:false next to a list of steps, which
  // failed validation ("A no-lookup plan cannot contain tool steps") and discarded the plan.
  it('keeps a plan whose own requiresLookup flag disagrees with its steps', async () => {
    mocks.createStructuredChatCompletion
      .mockResolvedValueOnce({
        output: { capabilities: ['finance'], requiresLookup: true, requiresWebSearch: false },
        usage: null,
      })
      .mockResolvedValueOnce({
        output: {
          requiresLookup: false,
          steps: [{ tool: 'finance_transactions', purpose: 'Find spending', dependsOn: [] }],
        },
        usage: null,
      });

    const plan = await planChatTools({
      model: 'test-model',
      messages: [{ role: 'user', content: 'how much did I spend last month?' }],
    });

    expect(plan.requiresLookup).toBe(true);
    expect(plan.steps.find((step) => step.tool === 'finance_transactions')?.purpose).toBe(
      'Find spending',
    );
  });

  // docs/observability.md: no provider response bodies in exported telemetry. A provider error
  // carries one in its message, so only its class and status may be logged.
  it('logs only the class and status of a provider error when the plan request fails', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    class ProviderError extends Error {
      status = 400;
    }
    mocks.createStructuredChatCompletion
      .mockResolvedValueOnce({
        output: { capabilities: ['finance'], requiresLookup: true, requiresWebSearch: false },
        usage: null,
      })
      .mockRejectedValueOnce(new ProviderError('body: secret schema detail from provider'));

    await planChatTools({
      model: 'test-model',
      messages: [{ role: 'user', content: 'how much did I spend last month?' }],
    });

    const fallback = warn.mock.calls.find(
      ([event]) => event === 'chat_tool_plan_validation_failed',
    );
    expect(fallback?.[1]).toMatchObject({ reason: 'Error', status: 400, fallbackUsed: true });
    expect(JSON.stringify(fallback?.[1])).not.toContain('secret schema detail');
    warn.mockRestore();
  });
});
