import { describe, expect, it, vi } from 'vitest';

import type { GenerationState, ToolResult } from './generation-machine';
import { createGenerationRunner, type ChatServerPersistedEvent } from './server';

function createStore() {
  const events: ChatServerPersistedEvent[] = [];
  const effects = new Map<string, ToolResult>();
  return {
    events,
    effects,
    appendEvent: vi.fn(async ({ event, idempotencyKey }) => {
      const record: ChatServerPersistedEvent = {
        generationId: 'generation-1',
        sequence: events.length + 1,
        type: event.type,
        payload: event,
        idempotencyKey,
      };
      events.push(record);
      return record;
    }),
    getEffect: vi.fn(async ({ idempotencyKey }) => effects.get(idempotencyKey) ?? null),
    saveEffect: vi.fn(async ({ idempotencyKey, result }) => {
      effects.set(idempotencyKey, result);
      return result;
    }),
    saveGeneration: vi.fn(async ({ state }) => ({
      id: 'generation-1:assistant',
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'assistant' as const,
      content: state.assistantText,
      files: null,
      toolCalls: null,
      reasoning: null,
      parentMessageId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    stopGeneration: vi.fn(async (_state: GenerationState) => undefined),
  };
}

const startContext = {
  chatId: 'chat-1',
  kind: 'send' as const,
  userMessageId: 'user-message-1',
  targetAssistantMessageId: null,
  requestContext: {},
};

describe('generation runner', () => {
  it('owns persistence and publication around a provider turn', async () => {
    const store = createStore();
    const published: ChatServerPersistedEvent[] = [];
    const onUsage = vi.fn();
    const runner = createGenerationRunner({
      provider: ({ onUsage }) => ({
        open: () =>
          (async function* () {
            yield { type: 'provider-chunk', chunk: { content: 'Hello' } };
            onUsage?.({ promptTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: null });
            yield {
              type: 'provider-turn-completed',
              requiredToolCall: false,
              confirmationCallIds: [],
            };
          })(),
        retry: async () => ({
          type: 'provider-turn-completed',
          requiredToolCall: false,
          confirmationCallIds: [],
        }),
      }),
      tools: {
        getDefinition: () => undefined,
        execute: vi.fn(),
      },
      store,
      publisher: {
        accept: async (event) => {
          published.push(event);
        },
      },
    });

    const result = await runner.generate({
      generationId: 'generation-1',
      chatId: 'chat-1',
      userId: 'user-1',
      model: { model: 'test', messages: [], tools: [], onUsage },
      startContext,
    });

    expect(result.state.assistantText).toBe('Hello');
    expect(store.appendEvent).toHaveBeenCalled();
    expect(published).toEqual(store.events);
    // The runner forwards onUsage untouched: accumulation is the caller's job,
    // so there is exactly one accumulator per generation.
    expect(onUsage).toHaveBeenCalledWith({
      promptTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      costUsd: null,
    });
  });
});
