// @vitest-environment jsdom
import type { GenerationEvent, GenerationPhase } from '@hominem/chat';
import type {
  ChatGenerationController,
  GenerationClientInputEvent,
  GenerationClientState,
} from '@hominem/chat/client';
import type { ChatMessageDto } from '@hominem/rpc/types';
import { useQueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { act, useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toGenerationStage } from '~/services/chat/chat-generation';
import type { ChatGenerationState } from '~/services/chat/chat-generation';
import { chatKeys } from '~/services/notes/query-keys';

import { mockMmkvModule } from '../../mocks/mmkv';
import { renderHookWithQueryClient } from '../../utils/render-hook';

const {
  mockAbortControllerRef,
  mockCancelGeneration,
  mockConsumeSseXhr,
  mockGenerationRef,
  mockGetAuthHeaders,
  mockRandomUUID,
} = vi.hoisted(() => {
  const mockAbortControllerRef: { current: AbortController | null } = { current: null };
  const mockGenerationRef: { current: ChatGenerationState | null } = { current: null };
  return {
    mockAbortControllerRef,
    mockCancelGeneration: vi.fn(),
    mockConsumeSseXhr: vi.fn(),
    mockCreateGeneration: vi.fn(),
    mockGenerationRef,
    mockGetAuthHeaders: vi.fn().mockResolvedValue({}),
    mockRandomUUID: vi.fn(),
  };
});

vi.mock('~/services/tasks/sync-chat-tasks', () => ({
  syncAfterChatTasks: vi.fn(),
}));
vi.mock('~/services/storage/mmkv', () => mockMmkvModule());
vi.mock('expo-crypto', () => ({ randomUUID: mockRandomUUID }));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
}));
vi.mock('~/components/media/audio-playback.service', () => ({ playAudioReply: vi.fn() }));
vi.mock('~/services/auth/auth-provider', () => ({
  useAuth: () => ({ getAuthHeaders: mockGetAuthHeaders }),
}));
vi.mock('~/services/chat/use-chat-generation', () => ({
  useChatGeneration: (options: {
    onGenerationEvent?: (
      event: GenerationClientInputEvent,
      generation: ChatGenerationState,
    ) => void;
  }) => {
    const [generation, setGenerationState] = useState<ChatGenerationState | null>(
      mockGenerationRef.current,
    );
    const createMockGeneration = (initial: ChatGenerationState) => {
      mockGenerationRef.current = initial;
      let state: GenerationClientState = {
        generationId: initial.id,
        phase: initial.stage === 'stopping' ? 'cancel_requested' : initial.stage,
        text: '',
        reasoning: '',
        toolSteps: [],
        lastDurableSequence: initial.lastDurableSequence,
        error: null,
      };
      const listeners = new Set<Parameters<ChatGenerationController['subscribe']>[0]>();
      const controller: ChatGenerationController = {
        get state() {
          return state;
        },
        signal: new AbortController().signal,
        done: Promise.resolve(state),
        subscribe: (listener) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        start: async () => {
          await mockConsumeSseXhr({
            onEvent: (event: GenerationEvent) => {
              const phase: GenerationPhase =
                event.type === 'generation.cancelled'
                  ? 'cancelled'
                  : event.type === 'generation.committed'
                    ? 'committed'
                    : event.type === 'generation.failed'
                      ? 'failed'
                      : event.type === 'generation.phase_changed'
                        ? event.payload.phase
                        : 'running';
              state = {
                ...state,
                phase,
                lastDurableSequence: event.sequence ?? state.lastDurableSequence,
                error: event.type === 'generation.failed' ? event.payload.message : state.error,
              };
              for (const listener of listeners) {
                listener(state, event);
              }
            },
          });
          return state;
        },
        resume: async () => state,
        cancel: vi.fn(),
      };
      return controller;
    };
    const bindController = (controller: ChatGenerationController, initial: ChatGenerationState) => {
      mockGenerationRef.current = initial;
      setGenerationState(initial);
      const unsubscribe = controller.subscribe((state, event) => {
        const current = mockGenerationRef.current;
        if (!current || current.id !== state.generationId) {
          return;
        }
        options.onGenerationEvent?.(event, current);
        if (state.phase === 'committed' || state.phase === 'cancelled') {
          queueMicrotask(() => {
            mockGenerationRef.current = null;
            setGenerationState(null);
          });
          return;
        }
        const error =
          'event' in event
            ? event.event.message
            : event.type === 'generation.failed'
              ? event.payload.message
              : undefined;
        const next = {
          ...current,
          stage: toGenerationStage(state.phase),
          lastDurableSequence: state.lastDurableSequence,
          ...(error ? { error } : {}),
        } satisfies ChatGenerationState;
        mockGenerationRef.current = next;
        setGenerationState(next);
      });
      return unsubscribe;
    };
    return {
      cancelGeneration: mockCancelGeneration,
      regenerateGeneration: (_input: unknown, initial: ChatGenerationState) => {
        const controller = createMockGeneration(initial);
        const unsubscribe = bindController(controller, initial);
        let resolveDone!: (state: GenerationClientState) => void;
        let rejectDone!: (error: unknown) => void;
        const done = new Promise<GenerationClientState>((resolve, reject) => {
          resolveDone = resolve;
          rejectDone = reject;
        });
        void done.then(unsubscribe, unsubscribe);
        queueMicrotask(() => {
          void controller.start({ path: '/stream', body: {} }).then(resolveDone, rejectDone);
        });
        return { ...controller, done };
      },
      respondToToolCall: vi.fn(),
      generation,
      generationRef: mockGenerationRef,
      setGeneration: (next: ChatGenerationState | null) => {
        mockGenerationRef.current = next;
        setGenerationState(next);
      },
    };
  },
}));
vi.mock('~/services/chat/use-chat-messages', () => ({
  toMessageOutput: (message: ChatMessageDto) => ({
    id: message.id,
    message: message.content,
    role: message.role,
  }),
}));
vi.mock('~/constants', () => ({ API_BASE_URL: 'http://localhost:4040' }));

const committedMessage = {
  id: 'assistant-2',
  chatId: 'chat-1',
  userId: 'user-1',
  role: 'assistant',
  content: 'Regenerated',
  files: null,
  toolCalls: null,
  reasoning: null,
  parentMessageId: 'assistant-1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
} satisfies ChatMessageDto;

const [{ useRegenerateMessage }, { useChatGeneration }, { handleChatGenerationEvent }] =
  await Promise.all([
    import('~/services/chat/use-regenerate-message'),
    import('~/services/chat/use-chat-generation'),
    import('~/services/chat/chat-cache'),
  ]);

function useRegenerateMessageWithRuntime() {
  const queryClient = useQueryClient();
  const onGenerationEvent = useCallback(
    (event: GenerationClientInputEvent, current: ChatGenerationState) =>
      handleChatGenerationEvent({ queryClient, chatId: 'chat-1', generation: current, event }),
    [queryClient],
  );
  const generationRuntime = useChatGeneration({
    chatId: 'chat-1',
    getAuthHeaders: mockGetAuthHeaders,
    onGenerationEvent,
  });
  const actions = useRegenerateMessage('chat-1', generationRuntime);
  return {
    ...actions,
    cancelGeneration: generationRuntime.cancelGeneration,
    generation: generationRuntime.generation,
  };
}

function eventStream(events: GenerationEvent[]) {
  mockConsumeSseXhr.mockImplementationOnce(
    ({
      onEvent,
      replayUrl,
    }: {
      onEvent: (event: GenerationEvent) => void;
      replayUrl?: (afterSequence: number) => string;
    }) => {
      replayUrl?.(0);
      events.forEach(onEvent);
      return Promise.resolve();
    },
  );
}

describe('useRegenerateMessage', () => {
  beforeEach(() => {
    mockRandomUUID.mockReturnValue('generation-1');
    mockGenerationRef.current = null;
    mockAbortControllerRef.current = null;
    mockConsumeSseXhr.mockReset();
    mockCancelGeneration.mockReset();
  });

  afterEach(() => vi.clearAllMocks());

  it('updates the target message after a committed regeneration', async () => {
    eventStream([
      {
        version: 1,
        generationId: 'generation-1',
        sequence: 1,
        type: 'generation.phase_changed',
        payload: { type: 'generation.phase_changed', phase: 'saving' },
      },
      {
        version: 1,
        generationId: 'generation-1',
        sequence: 2,
        type: 'generation.committed',
        payload: { type: 'generation.committed', message: committedMessage },
      },
    ]);

    const { result, queryClient } = renderHookWithQueryClient(useRegenerateMessageWithRuntime);
    queryClient.setQueryData(chatKeys.messages('chat-1'), [
      { id: 'assistant-1', message: 'Old', role: 'assistant' },
    ]);

    await act(async () => {
      result.current.regenerateMessage('assistant-1');
      await waitFor(() => expect(mockConsumeSseXhr).toHaveBeenCalledOnce());
    });

    await waitFor(() => expect(result.current.generation).toBeNull());
    expect(queryClient.getQueryData(chatKeys.messages('chat-1'))).toEqual([
      expect.objectContaining({ id: 'assistant-2', message: 'Regenerated', role: 'assistant' }),
    ]);
  });

  it('clears cancelled generations and retains failures for retry', async () => {
    eventStream([
      {
        version: 1,
        generationId: 'generation-1',
        sequence: 1,
        type: 'generation.cancelled',
        payload: { type: 'generation.cancelled' },
      },
    ]);
    const { result, queryClient } = renderHookWithQueryClient(useRegenerateMessageWithRuntime);

    await act(async () => {
      result.current.regenerateMessage('assistant-1');
      await waitFor(() => expect(result.current.generation).toBeNull());
    });

    mockConsumeSseXhr.mockRejectedValueOnce(new Error('regeneration failed'));
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    await act(async () => {
      result.current.retryGeneration();
      await waitFor(() => expect(result.current.generation?.stage).toBe('failed'));
    });

    expect(result.current.generation?.error).toBe('regeneration failed');
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: chatKeys.messages('chat-1') });
  });

  it('retries a restored failed regeneration using its persisted target message', async () => {
    mockGenerationRef.current = {
      id: 'generation-1',
      chatId: 'chat-1',
      stage: 'failed',
      lastDurableSequence: 4,
      targetMessageId: 'assistant-1',
    };
    const { result } = renderHookWithQueryClient(useRegenerateMessageWithRuntime);

    act(() => result.current.retryGeneration());

    await waitFor(() => expect(mockConsumeSseXhr).toHaveBeenCalledOnce());
    expect(result.current.generation).toMatchObject({
      stage: 'preparing',
      targetMessageId: 'assistant-1',
    });
  });

  it('delegates cancellation and retry to the active resource', async () => {
    mockConsumeSseXhr.mockImplementationOnce(() => new Promise<void>(() => undefined));
    const { result } = renderHookWithQueryClient(useRegenerateMessageWithRuntime);

    await act(async () => {
      result.current.regenerateMessage('assistant-1');
      await waitFor(() => expect(result.current.generation?.stage).toBe('preparing'));
      await result.current.cancelGeneration();
    });

    expect(mockCancelGeneration).toHaveBeenCalledOnce();
  });

  it('does not let an older regeneration failure overwrite a newer generation', async () => {
    let rejectFirst: ((error: Error) => void) | undefined;
    let rejectSecond: ((error: Error) => void) | undefined;
    mockRandomUUID.mockReturnValueOnce('generation-1').mockReturnValueOnce('generation-2');
    mockConsumeSseXhr
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectSecond = reject;
          }),
      );
    const { result } = renderHookWithQueryClient(useRegenerateMessageWithRuntime);

    await act(async () => {
      result.current.regenerateMessage('assistant-1');
      await waitFor(() => expect(mockConsumeSseXhr).toHaveBeenCalledOnce());
      result.current.regenerateMessage('assistant-2');
      await waitFor(() => expect(mockConsumeSseXhr).toHaveBeenCalledTimes(2));
      rejectFirst?.(new Error('older request failed'));
      await waitFor(() => expect(result.current.generation?.id).toBe('generation-2'));
    });

    expect(result.current.generation).toMatchObject({ id: 'generation-2', stage: 'preparing' });

    await act(async () => {
      rejectSecond?.(new Error('current request failed'));
      await waitFor(() => expect(result.current.generation?.stage).toBe('failed'));
    });
    expect(result.current.generation?.error).toBe('current request failed');
  });

  it('clears the generation after cancellation events', async () => {
    eventStream([
      {
        version: 1,
        generationId: 'generation-1',
        sequence: 1,
        type: 'generation.phase_changed',
        payload: { type: 'generation.phase_changed', phase: 'preparing' },
      },
      {
        version: 1,
        generationId: 'generation-1',
        sequence: 2,
        type: 'generation.phase_changed',
        payload: { type: 'generation.phase_changed', phase: 'cancel_requested' },
      },
      {
        version: 1,
        generationId: 'generation-1',
        sequence: 3,
        type: 'generation.cancelled',
        payload: { type: 'generation.cancelled' },
      },
    ]);

    const { result } = renderHookWithQueryClient(useRegenerateMessageWithRuntime);

    await act(async () => {
      result.current.regenerateMessage('assistant-1');
      await waitFor(() => expect(result.current.generation).toBeNull());
    });
  });
});
