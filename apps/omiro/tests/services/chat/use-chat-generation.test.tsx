// @vitest-environment jsdom
import type {
  ChatGenerationController,
  GenerationClientInputEvent,
  GenerationClientState,
} from '@hominem/chat/client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockMmkvModule } from '../../mocks/mmkv';

vi.mock('~/services/storage/mmkv', () => mockMmkvModule());
vi.mock('~/constants', () => ({ API_BASE_URL: 'http://localhost:4040' }));

const { storage } = await import('~/services/storage/mmkv');
const { useChatGeneration } = await import('~/services/chat/use-chat-generation');
const { persistGenerationCheckpoint, restoreGenerationCheckpoint } =
  await import('~/services/chat/chat-generation-checkpoint');
const { registerGenerationHandoff, takeGenerationHandoff } =
  await import('~/services/chat/generation-handoff');

// Minimal ChatGenerationController test double: enough surface for
// useChatGeneration's adoption path (state getter, subscribe, done), not a
// full ChatClient. `emit` pushes a new state to subscribers; `finish`
// resolves `done` the way a real controller does once the stream ends.
function createFakeController(
  initialState: Partial<GenerationClientState> & { generationId: string },
) {
  let state: GenerationClientState = {
    text: '',
    reasoning: '',
    toolSteps: [],
    error: null,
    lastDurableSequence: 0,
    phase: 'preparing',
    ...initialState,
  };
  const listeners = new Set<Parameters<ChatGenerationController['subscribe']>[0]>();
  let resolveDone!: (value: GenerationClientState) => void;
  const done = new Promise<GenerationClientState>((resolve) => {
    resolveDone = resolve;
  });
  const controller: ChatGenerationController = {
    get state() {
      return state;
    },
    signal: new AbortController().signal,
    done,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start: () => done,
    resume: () => done,
    cancel: () => undefined,
  };
  return {
    controller,
    listenerCount: () => listeners.size,
    emit: (next: Partial<GenerationClientState>) => {
      state = { ...state, ...next };
      // The hook under test only reads the state; the event is just a required argument.
      const event: GenerationClientInputEvent = {
        version: 1,
        generationId: state.generationId,
        event: { type: 'error', message: 'test emit' },
      };
      for (const listener of listeners) {
        listener(state, event);
      }
    },
    finish: (final: Partial<GenerationClientState>) => {
      state = { ...state, ...final };
      resolveDone(state);
    },
  };
}

const getAuthHeaders = vi.fn().mockResolvedValue({});
const { consumeGenerationSseXhr, mockCancelRequest } = vi.hoisted(() => ({
  consumeGenerationSseXhr: vi.fn(),
  mockCancelRequest: vi.fn(),
}));
const key = 'chat-generation:chat-1';

vi.mock('@hominem/chat/transport/xhr', () => ({
  xhrChatTransport: () => ({
    request: () => mockCancelRequest(),
    stream: async ({
      url,
      init,
      signal,
      onChunk,
    }: {
      url: string;
      init: RequestInit;
      signal?: AbortSignal;
      onChunk: (chunk: string) => void;
    }) => {
      await consumeGenerationSseXhr({
        method: init.method,
        url,
        getReplayCursor: () => 12,
        onEvent: (event: unknown) => onChunk(`data: ${JSON.stringify(event)}\n\n`),
        signal,
      });
      return { ok: true, status: 200 };
    },
  }),
}));

describe('useChatGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    takeGenerationHandoff('chat-1')?.releasePreviousSubscription?.();
    storage.remove(key);
    consumeGenerationSseXhr.mockResolvedValue(undefined);
    mockCancelRequest.mockResolvedValue(new Response('{}', { status: 200 }));
  });

  it('restores an active generation checkpoint from MMKV', () => {
    storage.set(
      key,
      JSON.stringify({
        generationId: 'generation-1',
        phase: 'awaiting_confirmation',
        lastDurableSequence: 12,
      }),
    );

    const { result } = renderHook(() => useChatGeneration({ chatId: 'chat-1', getAuthHeaders }));

    expect(result.current.generation).toEqual({
      id: 'generation-1',
      chatId: 'chat-1',
      stage: 'awaiting_confirmation',
      lastDurableSequence: 12,
    });
  });

  it('removes malformed checkpoints instead of restoring untrusted state', () => {
    storage.set(key, JSON.stringify({ generationId: 'generation-1', lastDurableSequence: -1 }));

    const { result } = renderHook(() => useChatGeneration({ chatId: 'chat-1', getAuthHeaders }));

    expect(result.current.generation).toBeNull();
    expect(storage.getString(key)).toBeUndefined();
  });

  it('persists cursor updates and clears terminal state', () => {
    const { result } = renderHook(() => useChatGeneration({ chatId: 'chat-1', getAuthHeaders }));

    act(() => {
      result.current.setGeneration({
        id: 'generation-1',
        chatId: 'chat-1',
        stage: 'running',
        lastDurableSequence: 7,
      });
    });
    expect(JSON.parse(storage.getString(key)!)).toEqual({
      generationId: 'generation-1',
      phase: 'running',
      lastDurableSequence: 7,
    });

    act(() => result.current.setGeneration(null));
    expect(storage.getString(key)).toBeUndefined();
  });

  it('restores the target message needed to retry a failed regeneration', () => {
    persistGenerationCheckpoint('chat-1', {
      id: 'generation-1',
      stage: 'failed',
      lastDurableSequence: 12,
      targetMessageId: 'assistant-1',
    });

    expect(restoreGenerationCheckpoint('chat-1')).toEqual({
      id: 'generation-1',
      chatId: 'chat-1',
      stage: 'failed',
      lastDurableSequence: 12,
      targetMessageId: 'assistant-1',
    });
  });

  it('keeps a failed cancellation visible and recoverable', async () => {
    storage.set(
      key,
      JSON.stringify({
        generationId: 'generation-1',
        phase: 'running',
        lastDurableSequence: 12,
      }),
    );
    let finishStream: (() => void) | undefined;
    consumeGenerationSseXhr.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishStream = resolve;
        }),
    );
    mockCancelRequest.mockRejectedValueOnce(new Error('network down'));
    const { result } = renderHook(() => useChatGeneration({ chatId: 'chat-1', getAuthHeaders }));

    await waitFor(() => expect(consumeGenerationSseXhr).toHaveBeenCalledOnce());
    await act(async () => result.current.cancelGeneration());

    expect(result.current.generation).toMatchObject({
      id: 'generation-1',
      stage: 'running',
      error: 'network down',
    });
    expect(mockCancelRequest).toHaveBeenCalledOnce();
    finishStream?.();
  });

  it('round-trips userMessageId seeded by a caller outside this hook', () => {
    persistGenerationCheckpoint('chat-1', {
      id: 'generation-1',
      stage: 'preparing',
      lastDurableSequence: 0,
      userMessageId: 'user-message-1',
    });

    const { result } = renderHook(() => useChatGeneration({ chatId: 'chat-1', getAuthHeaders }));

    expect(result.current.generation).toEqual({
      id: 'generation-1',
      chatId: 'chat-1',
      stage: 'preparing',
      lastDurableSequence: 0,
      userMessageId: 'user-message-1',
    });
  });

  it('round-trips a local retry input until the generation reaches the server', () => {
    persistGenerationCheckpoint('chat-1', {
      id: 'generation-1',
      stage: 'failed',
      lastDurableSequence: 0,
      userMessageId: 'user-message-1',
      retryInput: { message: 'Retry this', fileIds: ['file-1'] },
    });

    const { result } = renderHook(() => useChatGeneration({ chatId: 'chat-1', getAuthHeaders }));

    expect(result.current.generation).toMatchObject({
      stage: 'failed',
      userMessageId: 'user-message-1',
      retryInput: { message: 'Retry this', fileIds: ['file-1'] },
    });
  });

  it('preserves a seeded userMessageId across ChatClient-driven checkpoint writes', async () => {
    persistGenerationCheckpoint('chat-1', {
      id: 'generation-1',
      stage: 'preparing',
      lastDurableSequence: 0,
      userMessageId: 'user-message-1',
    });
    consumeGenerationSseXhr.mockImplementationOnce(
      async ({ onEvent }: { onEvent: (event: unknown) => void }) => {
        onEvent({
          version: 1,
          generationId: 'generation-1',
          sequence: 1,
          type: 'generation.phase_changed',
          payload: { type: 'generation.phase_changed', phase: 'running' },
        });
      },
    );

    const { result } = renderHook(() => useChatGeneration({ chatId: 'chat-1', getAuthHeaders }));

    await waitFor(() => expect(result.current.generation).toMatchObject({ stage: 'running' }));
    expect(result.current.generation).toMatchObject({ userMessageId: 'user-message-1' });
    expect(JSON.parse(storage.getString(key)!)).toMatchObject({ userMessageId: 'user-message-1' });
  });

  it('adopts a handed-off controller without opening a new SSE connection', async () => {
    const { controller, emit } = createFakeController({
      generationId: 'generation-1',
      phase: 'preparing',
      lastDurableSequence: 0,
    });
    const releasePreviousSubscription = vi.fn();
    registerGenerationHandoff('chat-1', {
      controller,
      releasePreviousSubscription,
      userMessageId: 'user-message-1',
    });

    const { result } = renderHook(() => useChatGeneration({ chatId: 'chat-1', getAuthHeaders }));

    // Available from the very first render -- no MMKV read, no stream call.
    expect(result.current.generation).toEqual({
      id: 'generation-1',
      chatId: 'chat-1',
      stage: 'preparing',
      lastDurableSequence: 0,
      userMessageId: 'user-message-1',
    });
    expect(consumeGenerationSseXhr).not.toHaveBeenCalled();
    await waitFor(() => expect(releasePreviousSubscription).toHaveBeenCalledOnce());

    act(() => emit({ phase: 'running', lastDurableSequence: 3 }));

    await waitFor(() => expect(result.current.generation).toMatchObject({ stage: 'running' }));
    expect(consumeGenerationSseXhr).not.toHaveBeenCalled();
    // The normal setGeneration -> persistGenerationCheckpoint path already
    // covers resume-after-reload from here on, same as any other generation.
    expect(JSON.parse(storage.getString(key)!)).toEqual({
      generationId: 'generation-1',
      phase: 'running',
      lastDurableSequence: 3,
      userMessageId: 'user-message-1',
    });
  });

  it('releases the previous listener for an already-finished handoff', async () => {
    const { controller } = createFakeController({
      generationId: 'generation-1',
      phase: 'committed',
      lastDurableSequence: 9,
    });
    const releasePreviousSubscription = vi.fn();
    registerGenerationHandoff('chat-1', {
      controller,
      releasePreviousSubscription,
      userMessageId: 'user-message-1',
    });

    const { result } = renderHook(() => useChatGeneration({ chatId: 'chat-1', getAuthHeaders }));

    expect(result.current.generation).toBeNull();
    expect(storage.getString(key)).toBeUndefined();
    await waitFor(() => expect(releasePreviousSubscription).toHaveBeenCalledOnce());
  });

  it('transfers the active controller listener when a chat screen remounts', async () => {
    const { controller, listenerCount } = createFakeController({
      generationId: 'generation-1',
      phase: 'running',
      lastDurableSequence: 3,
    });
    const releasePreviousSubscription = vi.fn();
    registerGenerationHandoff('chat-1', { controller, releasePreviousSubscription });

    const first = renderHook(() => useChatGeneration({ chatId: 'chat-1', getAuthHeaders }));
    await waitFor(() => expect(listenerCount()).toBe(1));
    first.unmount();

    const second = renderHook(() => useChatGeneration({ chatId: 'chat-1', getAuthHeaders }));
    await waitFor(() => expect(listenerCount()).toBe(1));

    expect(second.result.current.generation).toMatchObject({
      id: 'generation-1',
      stage: 'running',
      lastDurableSequence: 3,
    });
    expect(releasePreviousSubscription).toHaveBeenCalledOnce();
    expect(consumeGenerationSseXhr).not.toHaveBeenCalled();
    second.unmount();
    takeGenerationHandoff('chat-1', controller)?.releasePreviousSubscription?.();
  });

  it('does not consume the active controller during StrictMode render replay', async () => {
    const { controller, listenerCount } = createFakeController({
      generationId: 'generation-1',
      phase: 'running',
      lastDurableSequence: 3,
    });
    const releasePreviousSubscription = vi.fn();
    registerGenerationHandoff('chat-1', { controller, releasePreviousSubscription });
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;

    const { unmount } = renderHook(() => useChatGeneration({ chatId: 'chat-1', getAuthHeaders }), {
      wrapper,
    });

    await waitFor(() => expect(listenerCount()).toBe(1));
    expect(releasePreviousSubscription).toHaveBeenCalledOnce();
    expect(consumeGenerationSseXhr).not.toHaveBeenCalled();
    unmount();
    takeGenerationHandoff('chat-1', controller)?.releasePreviousSubscription?.();
  });

  it('reattaches an active checkpoint through durable GET replay', async () => {
    storage.set(
      key,
      JSON.stringify({
        generationId: 'generation-1',
        phase: 'running',
        lastDurableSequence: 12,
      }),
    );
    consumeGenerationSseXhr.mockImplementationOnce(
      async ({ onEvent }: { onEvent: (event: unknown) => void }) => {
        onEvent({
          version: 1,
          generationId: 'generation-1',
          sequence: 13,
          type: 'generation.phase_changed',
          payload: { type: 'generation.phase_changed', phase: 'saving' },
        });
      },
    );

    const { result } = renderHook(() => useChatGeneration({ chatId: 'chat-1', getAuthHeaders }));

    await waitFor(() => expect(consumeGenerationSseXhr).toHaveBeenCalledOnce());
    expect(consumeGenerationSseXhr).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        getReplayCursor: expect.any(Function),
      }),
    );
    expect(result.current.generation).toMatchObject({
      id: 'generation-1',
      stage: 'running',
      lastDurableSequence: 13,
    });
  });

  it('clears a restored checkpoint and refreshes chat data after commit', async () => {
    const onGenerationTerminal = vi.fn();
    storage.set(
      key,
      JSON.stringify({
        generationId: 'generation-1',
        phase: 'saving',
        lastDurableSequence: 12,
      }),
    );
    consumeGenerationSseXhr.mockImplementationOnce(
      async ({ onEvent }: { onEvent: (event: unknown) => void }) => {
        onEvent({
          version: 1,
          generationId: 'generation-1',
          sequence: 13,
          type: 'generation.committed',
          payload: {
            type: 'generation.committed',
            message: {
              id: 'message-1',
              chatId: 'chat-1',
              userId: 'user-1',
              role: 'assistant',
              content: 'Done',
              files: null,
              toolCalls: null,
              reasoning: null,
              parentMessageId: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        });
      },
    );

    const { result } = renderHook(() =>
      useChatGeneration({ chatId: 'chat-1', getAuthHeaders, onGenerationTerminal }),
    );

    await waitFor(() => expect(result.current.generation).toBeNull());
    expect(storage.getString(key)).toBeUndefined();
    expect(onGenerationTerminal).toHaveBeenCalledOnce();
  });
});
