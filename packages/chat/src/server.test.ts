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

function createToolProvider() {
  let turn = 0;
  return () => ({
    open: () =>
      (async function* () {
        if (turn++ === 0) {
          yield {
            type: 'provider-chunk' as const,
            chunk: {
              content: '',
              toolCalls: [
                { index: 0, id: 'call-1', function: { name: 'lookup', arguments: '{}' } },
              ],
            },
          };
        }
        yield {
          type: 'provider-turn-completed' as const,
          requiredToolCall: turn === 1,
          confirmationCallIds: [],
        };
      })(),
    retry: async () => ({
      type: 'provider-turn-completed' as const,
      requiredToolCall: false,
      confirmationCallIds: [],
    }),
  });
}

describe('generation runner', () => {
  it('owns persistence and publication around a provider turn', async () => {
    const store = createStore();
    const published: ChatServerPersistedEvent[] = [];
    const onUsage = vi.fn();
    const runner = createGenerationRunner({
      provider: () => ({
        open: () =>
          (async function* () {
            yield { type: 'provider-chunk', chunk: { content: 'Hello' } };
            onUsage?.({ promptTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: null });
            yield {
              type: 'provider-turn-completed',
              requiredToolCall: true,
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

  describe('stored-effect replay', () => {
    it('short-circuits when an effect is already stored', async () => {
      const store = createStore();
      const toolResult: ToolResult = {
        callId: 'call-1',
        toolName: 'lookup',
        content: '{"cached":true}',
        error: false,
      };
      store.effects.set('generation-1:generation-1:0:call-1', toolResult);

      const execute = vi.fn(async () => ({
        callId: 'call-1',
        toolName: 'lookup',
        content: '{"fresh":true}',
        error: false,
      }));

      const runner = createGenerationRunner({
        provider: createToolProvider(),
        tools: {
          getDefinition: () => undefined,
          execute,
        },
        store,
      });

      const result = await runner.generate({
        generationId: 'generation-1',
        chatId: 'chat-1',
        userId: 'user-1',
        model: { model: 'test', messages: [], tools: [], onUsage: vi.fn() },
        startContext,
      });

      expect(execute).not.toHaveBeenCalled();
      expect(store.getEffect).toHaveBeenCalled();
      expect(result.toolResults.get('call-1')).toEqual(toolResult);
    });

    it('saves a fresh result through the store when no effect is stored', async () => {
      const store = createStore();
      const execute = vi.fn(async () => ({
        callId: 'call-1',
        toolName: 'lookup',
        content: '{"fresh":true}',
        error: false,
      }));

      const runner = createGenerationRunner({
        provider: createToolProvider(),
        tools: {
          getDefinition: () => undefined,
          execute,
        },
        store,
      });

      const result = await runner.generate({
        generationId: 'generation-1',
        chatId: 'chat-1',
        userId: 'user-1',
        model: { model: 'test', messages: [], tools: [], onUsage: vi.fn() },
        startContext,
      });

      expect(execute).toHaveBeenCalledTimes(1);
      expect(store.saveEffect).toHaveBeenCalled();
      expect(result.toolResults.get('call-1')).toMatchObject({ content: '{"fresh":true}' });
    });
  });
});
