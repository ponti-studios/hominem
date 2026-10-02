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
});
