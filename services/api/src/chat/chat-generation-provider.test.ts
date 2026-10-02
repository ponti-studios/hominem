import { streamChatCompletion } from '@hominem/ai';
import type { ChatStreamChunk } from '@hominem/ai';
import { createGenerationState } from '@hominem/chat/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_CALLS_PER_TOOL, OpenRouterChatModel } from './chat-generation-provider';

const mockedLogger = vi.hoisted(() => ({ warn: vi.fn() }));
const mockedOpenRouterRequestError = vi.hoisted(
  () => class OpenRouterRequestError extends Error {},
);

vi.mock('@hominem/ai', () => ({
  streamChatCompletion: vi.fn(),
  getChatCompletionUsage: vi.fn((response: { usage?: unknown }) => response.usage ?? null),
  OpenRouterRequestError: mockedOpenRouterRequestError,
}));

vi.mock('@hominem/telemetry', () => ({ logger: mockedLogger }));

const mockedStream = vi.mocked(streamChatCompletion);
type StreamChunk =
  Awaited<ReturnType<typeof streamChatCompletion>> extends AsyncIterable<infer T> ? T : never;

function chunk(
  choices: ChatStreamChunk['choices'],
  error?: ChatStreamChunk['error'],
): ChatStreamChunk {
  return {
    choices,
    created: 0,
    id: 'chunk-1',
    model: 'test-model',
    object: 'chat.completion.chunk',
    ...(error ? { error } : {}),
  };
}

function usageTrailer(usage: NonNullable<ChatStreamChunk['usage']>): StreamChunk {
  return {
    choices: [],
    created: 0,
    id: 'trailer',
    model: 'test-model',
    object: 'chat.completion.chunk',
    usage,
  };
}

async function* chunks(values: readonly StreamChunk[]): AsyncGenerator<StreamChunk> {
  yield* values;
}

async function collect<T>(values: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];
  for await (const value of values) collected.push(value);
  return collected;
}

// Delivers `values` immediately, then hangs forever on the next `.next()`
// call — simulating OpenRouter delivering a complete response and then
// leaving the connection open with no more bytes and no close. `.return()`
// hangs too, matching a real async generator suspended on that same stalled
// read: cancelling it doesn't settle until the inner await does. Any code
// that awaits `.return()` here will hang right along with it — which is the
// point of modeling it this faithfully.
function stallingAfter(values: readonly StreamChunk[]): AsyncGenerator<StreamChunk> {
  let index = 0;
  const generator: AsyncGenerator<StreamChunk> = {
    next: (): Promise<IteratorResult<StreamChunk>> => {
      if (index < values.length) {
        return Promise.resolve({ done: false, value: values[index++]! });
      }
      return new Promise(() => {});
    },
    return: (): Promise<IteratorResult<StreamChunk>> => new Promise(() => {}),
    throw: (error: unknown) => Promise.reject(error),
    [Symbol.asyncIterator]() {
      return generator;
    },
    [Symbol.asyncDispose]: async () => {},
  };
  return generator;
}

describe('OpenRouter generation provider', () => {
  beforeEach(() => {
    mockedStream.mockReset();
    mockedLogger.warn.mockReset();
  });

  it('translates text, reasoning, and fragmented tool calls into machine inputs', async () => {
    mockedStream.mockReturnValueOnce(
      chunks([
        chunk([{ index: 0, finishReason: null, delta: { content: 'Hello', reasoning: 'plan ' } }]),
        chunk([
          {
            index: 0,
            finishReason: null,
            delta: {
              toolCalls: [
                { index: 1, id: 'second', function: { name: 'second', arguments: '{}' } },
                {
                  index: 0,
                  id: 'first',
                  type: 'function',
                  function: { name: 'first', arguments: '{"q' },
                },
              ],
            },
          },
        ]),
        chunk([
          {
            index: 0,
            finishReason: null,
            delta: {
              content: ' world',
              reasoning: 'execute',
              toolCalls: [{ index: 0, function: { arguments: '":"x"}' } }],
            },
          },
        ]),
      ]),
    );
    const provider = new OpenRouterChatModel({
      model: 'test-model',
      messages: [],
      tools: [
        { type: 'function', function: { name: 'first', description: 'first', parameters: {} } },
      ],
      requiresToolCall: true,
      requiresConfirmation: (name) => name === 'second',
    });

    const inputs = await collect(
      provider.open({
        turnId: 'turn-1',
        iteration: 0,
        state: createGenerationState('generation-1'),
      }),
    );

    expect(inputs).toEqual([
      {
        type: 'provider-chunk',
        chunk: { content: 'Hello', reasoning: 'plan ', toolCalls: undefined },
      },
      {
        type: 'provider-chunk',
        chunk: {
          content: undefined,
          reasoning: undefined,
          toolCalls: [
            { index: 1, id: 'second', function: { name: 'second', arguments: '{}' } },
            { index: 0, id: 'first', function: { name: 'first', arguments: '{"q' } },
          ],
        },
      },
      {
        type: 'provider-chunk',
        chunk: {
          content: ' world',
          reasoning: 'execute',
          toolCalls: [{ index: 0, function: { arguments: '":"x"}' } }],
        },
      },
      {
        type: 'provider-turn-completed',
        requiredToolCall: true,
        confirmationCallIds: ['second'],
      },
    ]);

    expect(mockedStream).toHaveBeenCalledWith(
      expect.objectContaining({ toolChoice: 'required', parallelToolCalls: false }),
      expect.anything(),
    );
    expect(mockedStream.mock.calls[0]?.[0].messages).toEqual([
      {
        role: 'assistant',
        content: null,
        toolCalls: [
          {
            id: 'first',
            type: 'function',
            function: { name: 'first', arguments: '{"q":"x"}' },
          },
          {
            id: 'second',
            type: 'function',
            function: { name: 'second', arguments: '{}' },
          },
        ],
      },
    ]);
  });

  it('only requires a tool on the first turn and preserves tool-result transcript order', async () => {
    mockedStream
      .mockReturnValueOnce(
        chunks([chunk([{ index: 0, finishReason: null, delta: { content: 'first' } }])]),
      )
      .mockReturnValueOnce(
        chunks([chunk([{ index: 0, finishReason: null, delta: { content: 'second' } }])]),
      );
    const provider = new OpenRouterChatModel({
      model: 'test-model',
      messages: [],
      tools: [
        { type: 'function', function: { name: 'lookup', description: 'lookup', parameters: {} } },
      ],
      requiresToolCall: true,
    });
    const state = createGenerationState('generation-1');

    await collect(provider.open({ turnId: 'turn-1', iteration: 0, state }));
    provider.appendToolResult({
      call: { id: 'call-1' },
      result: { content: 'result' },
    });
    await collect(
      provider.open({ turnId: 'turn-2', iteration: 1, state: { ...state, iteration: 1 } }),
    );

    expect(mockedStream).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ toolChoice: 'required' }),
      expect.anything(),
    );
    expect(mockedStream).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ toolChoice: 'auto' }),
      expect.anything(),
    );
    expect(mockedStream.mock.calls[1]?.[0].messages).toEqual([
      { role: 'tool', toolCallId: 'call-1', content: 'result' },
    ]);
  });

  it('classifies transient provider failures for machine retries', async () => {
    const error = Object.assign(new Error('rate limited'), { status: 429 });
    mockedStream.mockImplementationOnce(() => {
      throw error;
    });
    const provider = new OpenRouterChatModel({
      model: 'test-model',
      messages: [],
      tools: [],
    });

    await expect(
      collect(
        provider.open({
          turnId: 'turn-1',
          iteration: 0,
          state: createGenerationState('generation-1'),
        }),
      ),
    ).resolves.toEqual([
      {
        type: 'provider-turn-failed',
        message: 'rate limited',
        transient: true,
        attempt: 0,
        maxAttempts: 2,
      },
    ]);

    mockedStream.mockReturnValueOnce(
      chunks([chunk([{ index: 0, finishReason: 'stop', delta: { content: 'ok' } }])]),
    );
    await expect(
      collect(
        provider.retry({
          attempt: 1,
          state: { ...createGenerationState('generation-1'), iteration: 1 },
        }),
      ),
    ).resolves.toContainEqual({
      type: 'provider-turn-completed',
      requiredToolCall: false,
      confirmationCallIds: [],
    });
  });

  it('passes an AbortSignal to streamChatCompletion', async () => {
    mockedStream.mockReturnValueOnce(chunks([]));
    const provider = new OpenRouterChatModel({ model: 'test-model', messages: [], tools: [] });

    await collect(
      provider.open({
        turnId: 'turn-1',
        iteration: 0,
        state: createGenerationState('generation-1'),
      }),
    );

    const options = mockedStream.mock.calls[0]?.[1];
    expect(options).toMatchObject({ signal: expect.any(AbortSignal) });
  });

  it('completes as soon as a chunk reports a finish reason, without waiting on the stream to close', async () => {
    // `stallingAfter` hangs forever past its given chunks — if the provider
    // stalls waiting for this to resolve after the finish-reason chunk, the
    // test times out. Resolving quickly is the proof the loop broke early.
    mockedStream.mockReturnValueOnce(
      stallingAfter([chunk([{ index: 0, finishReason: 'stop', delta: { content: 'hi' } }])]),
    );
    const provider = new OpenRouterChatModel({ model: 'test-model', messages: [], tools: [] });

    await expect(
      collect(
        provider.open({
          turnId: 'turn-1',
          iteration: 0,
          state: createGenerationState('generation-1'),
        }),
      ),
    ).resolves.toEqual([
      {
        type: 'provider-chunk',
        chunk: { content: 'hi', reasoning: undefined, toolCalls: undefined },
      },
      {
        type: 'provider-turn-completed',
        requiredToolCall: false,
        confirmationCallIds: [],
      },
    ]);
  });

  describe('an empty provider turn', () => {
    const run = async (
      values: readonly StreamChunk[],
      options: { requiresToolCall?: boolean } = {},
    ) => {
      mockedStream.mockReturnValueOnce(chunks(values));
      const provider = new OpenRouterChatModel({
        model: 'test-model',
        messages: [],
        tools: [
          { type: 'function', function: { name: 'task_list', description: 'x', parameters: {} } },
        ],
        generationId: 'generation-7',
        maxTokens: 250,
        ...options,
      });
      return collect(
        provider.open({
          turnId: 'turn-1',
          iteration: 0,
          state: createGenerationState('generation-7'),
        }),
      );
    };

    // Surfaces to the user as "No reply was generated"; the log has to say why.
    it('logs what came back when there is neither text nor a tool call', async () => {
      await run(
        [
          chunk([{ index: 0, finishReason: null, delta: { reasoning: 'thinking it over' } }]),
          chunk([{ index: 0, finishReason: 'length', delta: {} }]),
        ],
        { requiresToolCall: true },
      );

      expect(mockedLogger.warn).toHaveBeenCalledWith('provider_turn_empty', {
        generationId: 'generation-7',
        model: 'test-model',
        iteration: 0,
        servedModel: 'test-model',
        toolChoice: 'required',
        completionCap: 250,
        toolCount: 1,
        usage: null,
        finishReasons: ['length'],
        chunkCount: 2,
        reasoningChars: 'thinking it over'.length,
        rawToolCallCount: 0,
      });
    });

    it('is reported as a transient failure so the turn is asked again', async () => {
      const inputs = await run([chunk([{ index: 0, finishReason: 'length', delta: {} }])], {
        requiresToolCall: true,
      });

      expect(inputs.at(-1)).toEqual({
        type: 'provider-turn-failed',
        message: 'No reply was generated',
        transient: true,
        attempt: 0,
        maxAttempts: 2,
      });
      expect(inputs.some((input) => input.type === 'provider-turn-completed')).toBe(false);
    });

    it('does not log for a turn that produced text', async () => {
      await run([chunk([{ index: 0, finishReason: 'stop', delta: { content: 'hello' } }])]);

      expect(mockedLogger.warn).not.toHaveBeenCalledWith('provider_turn_empty', expect.anything());
    });

    it('does not log for a turn that made a tool call', async () => {
      await run([
        chunk([
          {
            index: 0,
            finishReason: 'tool_calls',
            delta: {
              toolCalls: [
                { index: 0, id: 'call-1', function: { name: 'task_list', arguments: '{}' } },
              ],
            },
          },
        ]),
      ]);

      expect(mockedLogger.warn).not.toHaveBeenCalledWith('provider_turn_empty', expect.anything());
    });
  });

  describe('a tool the model keeps calling', () => {
    const offered = () =>
      (mockedStream.mock.calls.at(-1)?.[0].tools ?? []).map((tool) =>
        'function' in tool ? tool.function.name : tool.type,
      );

    it('is withdrawn after MAX_CALLS_PER_TOOL calls so the model has to answer', async () => {
      const provider = new OpenRouterChatModel({
        model: 'test-model',
        messages: [],
        tools: [
          { type: 'function', function: { name: 'task_list', description: 'x', parameters: {} } },
          { type: 'function', function: { name: 'task_update', description: 'x', parameters: {} } },
        ],
        generationId: 'generation-9',
      });
      const state = createGenerationState('generation-9');

      for (let call = 1; call <= MAX_CALLS_PER_TOOL; call++) {
        mockedStream.mockReturnValueOnce(
          chunks([
            chunk([
              {
                index: 0,
                finishReason: 'tool_calls',
                delta: {
                  toolCalls: [
                    { index: 0, id: `c${call}`, function: { name: 'task_list', arguments: '{}' } },
                  ],
                },
              },
            ]),
          ]),
        );
        await collect(provider.open({ turnId: `t${call}`, iteration: call - 1, state }));
        expect(offered()).toEqual(['task_list', 'task_update']);
      }

      mockedStream.mockReturnValueOnce(
        chunks([chunk([{ index: 0, finishReason: 'stop', delta: { content: 'done' } }])]),
      );
      await collect(provider.open({ turnId: 'last', iteration: MAX_CALLS_PER_TOOL, state }));

      expect(offered()).toEqual(['task_update']);
      expect(mockedLogger.warn).toHaveBeenCalledWith('provider_tool_withdrawn', {
        generationId: 'generation-9',
        toolName: 'task_list',
        calls: MAX_CALLS_PER_TOOL,
      });
    });
  });

  it('captures a usage-only trailer chunk sent after the finish-reason chunk', async () => {
    const usage = { promptTokens: 1, completionTokens: 2, totalTokens: 3, cost: 0.01 };
    mockedStream.mockReturnValueOnce(
      chunks([
        chunk([{ index: 0, finishReason: 'stop', delta: { content: 'hi' } }]),
        usageTrailer(usage),
      ]),
    );
    const onUsage = vi.fn();
    const provider = new OpenRouterChatModel({
      model: 'test-model',
      messages: [],
      tools: [],
      onUsage,
    });

    await collect(
      provider.open({
        turnId: 'turn-1',
        iteration: 0,
        state: createGenerationState('generation-1'),
      }),
    );

    expect(onUsage).toHaveBeenLastCalledWith(usage);
  });

  it('does not wait past the grace window for a trailer chunk that never arrives', async () => {
    mockedStream.mockReturnValueOnce(
      stallingAfter([chunk([{ index: 0, finishReason: 'stop', delta: { content: 'hi' } }])]),
    );
    const onUsage = vi.fn();
    const provider = new OpenRouterChatModel({
      model: 'test-model',
      messages: [],
      tools: [],
      onUsage,
    });

    vi.useFakeTimers();
    try {
      const resultPromise = collect(
        provider.open({
          turnId: 'turn-1',
          iteration: 0,
          state: createGenerationState('generation-1'),
        }),
      );
      await vi.advanceTimersByTimeAsync(500);
      await expect(resultPromise).resolves.toEqual([
        {
          type: 'provider-chunk',
          chunk: { content: 'hi', reasoning: undefined, toolCalls: undefined },
        },
        {
          type: 'provider-turn-completed',
          requiredToolCall: false,
          confirmationCallIds: [],
        },
      ]);
      expect(onUsage).toHaveBeenCalledTimes(1);
      expect(onUsage).toHaveBeenCalledWith(null);
      expect(mockedStream.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries a stream that goes idle before ever reporting a finish reason', async () => {
    mockedStream.mockReturnValueOnce(
      stallingAfter([chunk([{ index: 0, finishReason: null, delta: { content: 'partial' } }])]),
    );
    const provider = new OpenRouterChatModel({ model: 'test-model', messages: [], tools: [] });

    vi.useFakeTimers();
    try {
      const resultPromise = collect(
        provider.open({
          turnId: 'turn-1',
          iteration: 0,
          state: createGenerationState('generation-1'),
        }),
      );
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(resultPromise).resolves.toEqual([
        {
          type: 'provider-chunk',
          chunk: { content: 'partial', reasoning: undefined, toolCalls: undefined },
        },
        {
          type: 'provider-turn-failed',
          message: 'No provider chunk received for 10000ms',
          transient: true,
          attempt: 0,
          maxAttempts: 2,
        },
      ]);
      expect(mockedStream.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('classifies a timed-out or dropped connection as transient', async () => {
    const timeoutError = Object.assign(new Error('Request timed out'), { code: 'timeout' });
    mockedStream.mockImplementationOnce(() => {
      throw timeoutError;
    });
    const provider = new OpenRouterChatModel({
      model: 'test-model',
      messages: [],
      tools: [],
    });

    await expect(
      collect(
        provider.open({
          turnId: 'turn-1',
          iteration: 0,
          state: createGenerationState('generation-1'),
        }),
      ),
    ).resolves.toEqual([
      {
        type: 'provider-turn-failed',
        message: 'Request timed out',
        transient: true,
        attempt: 0,
        maxAttempts: 2,
      },
    ]);

    const connectionError = Object.assign(new Error('Unable to make request'), {
      code: 'connection_error',
    });
    mockedStream.mockImplementationOnce(() => {
      throw connectionError;
    });
    await expect(
      collect(
        provider.retry({
          attempt: 1,
          state: { ...createGenerationState('generation-1'), iteration: 1 },
        }),
      ),
    ).resolves.toEqual([
      {
        type: 'provider-turn-failed',
        message: 'Unable to make request',
        transient: true,
        attempt: 1,
        maxAttempts: 2,
      },
    ]);
  });

  it('normalizes sparse chunks and provider errors without assuming Error instances', async () => {
    mockedStream.mockReturnValueOnce(
      chunks([
        chunk([]),
        chunk([
          {
            index: 0,
            finishReason: null,
            delta: { content: null, reasoning: null, toolCalls: [] },
          },
        ]),
        chunk([
          {
            index: 0,
            finishReason: null,
            delta: { toolCalls: [{ index: 0, function: {} }] },
          },
        ]),
        chunk([], { code: 500, message: 'provider returned an error' }),
      ]),
    );
    const provider = new OpenRouterChatModel({
      model: 'test-model',
      messages: [],
      tools: [],
      maxAttempts: 4,
    });

    await expect(
      collect(
        provider.open({
          turnId: 'turn-1',
          iteration: 2,
          state: { ...createGenerationState('generation-1'), iteration: 2 },
        }),
      ),
    ).resolves.toEqual([
      {
        type: 'provider-chunk',
        chunk: { content: undefined, reasoning: undefined, toolCalls: undefined },
      },
      {
        type: 'provider-chunk',
        chunk: { content: null, reasoning: null, toolCalls: [] },
      },
      {
        type: 'provider-chunk',
        chunk: {
          content: undefined,
          reasoning: undefined,
          toolCalls: [{ index: 0, function: {} }],
        },
      },
      {
        type: 'provider-turn-failed',
        message: 'provider returned an error',
        transient: false,
        attempt: 2,
        maxAttempts: 4,
      },
    ]);

    mockedStream.mockImplementationOnce(() => {
      throw 'provider failed without an Error';
    });
    await expect(
      collect(
        provider.open({
          turnId: 'turn-2',
          iteration: 0,
          state: createGenerationState('generation-1'),
        }),
      ),
    ).resolves.toContainEqual({
      type: 'provider-turn-failed',
      message: 'Provider request failed',
      transient: false,
      attempt: 0,
      maxAttempts: 4,
    });

    mockedStream.mockReturnValueOnce(
      chunks([chunk([{ index: 0, finishReason: null, delta: { toolCalls: [{ index: 0 }] } }])]),
    );
    await expect(
      collect(
        provider.open({
          turnId: 'turn-3',
          iteration: 0,
          state: createGenerationState('generation-1'),
        }),
      ),
    ).resolves.toContainEqual({
      type: 'provider-turn-completed',
      requiredToolCall: false,
      confirmationCallIds: [],
    });

    mockedStream.mockImplementationOnce(() => {
      throw Object.assign(new Error('provider failed with an unsupported status'), { status: 500 });
    });
    await expect(
      collect(
        provider.open({
          turnId: 'turn-4',
          iteration: 0,
          state: createGenerationState('generation-1'),
        }),
      ),
    ).resolves.toContainEqual({
      type: 'provider-turn-failed',
      message: 'provider failed with an unsupported status',
      transient: false,
      attempt: 0,
      maxAttempts: 4,
    });
  });

  it('rejects malformed provider tool-call chunks before they reach the machine', async () => {
    mockedStream.mockReturnValueOnce(
      chunks([
        chunk([
          {
            index: -1,
            finishReason: null,
            delta: { toolCalls: [{ index: -1, function: { arguments: '{}' } }] },
          },
        ]),
      ]),
    );
    const provider = new OpenRouterChatModel({
      model: 'test-model',
      messages: [],
      tools: [],
    });

    await expect(
      collect(
        provider.open({
          turnId: 'turn-invalid',
          iteration: 0,
          state: createGenerationState('generation-1'),
        }),
      ),
    ).resolves.toEqual([
      {
        type: 'provider-turn-failed',
        message: 'Provider returned an invalid generation chunk',
        transient: false,
        attempt: 0,
        maxAttempts: 2,
      },
    ]);
    expect(mockedLogger.warn).toHaveBeenCalledWith('provider_chunk_rejected', {
      model: 'test-model',
      iteration: 0,
      issuePaths: ['toolCalls.0.index'],
      shape: {
        choiceCount: 1,
        hasDelta: true,
        contentType: 'undefined',
        reasoningType: 'undefined',
        toolCallsType: 'array',
        toolCallIndexes: [-1],
        toolCallFunctionKeys: [['arguments']],
      },
    });
  });
});
