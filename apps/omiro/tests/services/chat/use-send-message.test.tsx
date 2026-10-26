// @vitest-environment jsdom
import type { GenerationEvent } from '@hominem/chat';
import type { GenerationClientInputEvent } from '@hominem/chat/client';
import type { ChatMessageDto } from '@hominem/rpc/types';
import { useQueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { act, useCallback } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatMessageItem } from '~/components/chat';
import type { ChatGenerationState } from '~/services/chat/chat-generation';
import { deriveChatRows } from '~/services/chat/chat-rows';
import { clearLiveChat, getLiveChat } from '~/services/chat/live-turn-store';
import { chatKeys } from '~/services/notes/query-keys';

import { mockMmkvModule } from '../../mocks/mmkv';
import { renderHookWithQueryClient } from '../../utils/render-hook';

const mockImpactAsync = vi.fn().mockResolvedValue(undefined);
const mockRandomUUID = vi.fn();
const mockGetAuthHeaders = vi.fn().mockResolvedValue({});
const mockNetInfoFetch = vi.fn().mockResolvedValue({ isConnected: true });
const mockConsumeSseXhr = vi.fn();

vi.mock('~/services/tasks/sync-chat-tasks', () => ({
  syncAfterChatTasks: vi.fn(),
}));
vi.mock('~/services/storage/mmkv', () => mockMmkvModule());
vi.mock('expo-haptics', () => ({
  impactAsync: mockImpactAsync,
  ImpactFeedbackStyle: { Light: 'light' },
}));
vi.mock('expo-crypto', () => ({ randomUUID: mockRandomUUID }));
vi.mock('~/services/auth/auth-provider', () => ({
  useAuth: () => ({ getAuthHeaders: mockGetAuthHeaders }),
}));
vi.mock('~/components/media/audio-playback.service', () => ({ playAudioReply: vi.fn() }));
vi.mock('@react-native-community/netinfo', () => ({ default: { fetch: mockNetInfoFetch } }));
vi.mock('@hominem/chat/transport/xhr', () => ({
  xhrChatTransport: () => ({
    request: async () => new Response('{}', { status: 200 }),
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
      await mockConsumeSseXhr({
        url,
        init,
        onEvent: (event: GenerationEvent) => onChunk(`data: ${JSON.stringify(event)}\n\n`),
        signal,
      });
      return { ok: true, status: 200 };
    },
  }),
}));
vi.mock('~/services/chat/use-chat-messages', () => ({
  toMessageOutput: (message: { id: string; role: 'user' | 'assistant'; content: string }) => ({
    id: message.id,
    renderKey: message.id,
    role: message.role,
    message: message.content,
    createdAt: new Date().toISOString(),
    chatId: CHAT_ID,
    reasoning: null,
    toolCalls: null,
    isStreaming: false,
  }),
}));
vi.mock('~/constants', () => ({ API_BASE_URL: 'http://localhost:4040' }));

const [
  { useSendMessage },
  { useChatGeneration },
  { handleChatGenerationEvent, resetChatCacheState },
] = await Promise.all([
  import('~/services/chat/use-send-message'),
  import('~/services/chat/use-chat-generation'),
  import('~/services/chat/chat-cache'),
]);

const CHAT_ID = 'chat-1';

function useSendMessageWithRuntime() {
  const queryClient = useQueryClient();
  const onGenerationEvent = useCallback(
    (event: GenerationClientInputEvent, current: ChatGenerationState) =>
      handleChatGenerationEvent({ queryClient, chatId: CHAT_ID, generation: current, event }),
    [queryClient],
  );
  const generation = useChatGeneration({
    chatId: CHAT_ID,
    getAuthHeaders: mockGetAuthHeaders,
    onGenerationEvent,
  });
  return useSendMessage({ chatId: CHAT_ID, generation });
}

const committedMessage = {
  id: 'assistant-1',
  chatId: CHAT_ID,
  userId: 'user-1',
  role: 'assistant',
  content: 'A durable reply.',
  files: null,
  toolCalls: null,
  reasoning: null,
  parentMessageId: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
} satisfies ChatMessageDto;

type PendingStream = {
  onEvent: (event: GenerationEvent) => void;
  resolve: () => void;
  reject: (error: Error) => void;
};

let pending: PendingStream | null = null;

// What the chat screen shows: the cache with the live turn laid over it.
function rows(queryClient: { getQueryData: <T>(key: readonly unknown[]) => T | undefined }) {
  return deriveChatRows(
    queryClient.getQueryData<ChatMessageItem[]>(chatKeys.messages(CHAT_ID)) ?? [],
    getLiveChat(CHAT_ID),
  );
}

describe('useSendMessage', () => {
  beforeEach(() => {
    mockRandomUUID.mockReturnValue('uuid-1');
    mockConsumeSseXhr.mockImplementation(
      ({
        onEvent,
        replayUrl,
      }: {
        onEvent: (event: GenerationEvent) => void;
        replayUrl?: (afterSequence: number) => string;
      }) =>
        new Promise<void>((resolve, reject) => {
          replayUrl?.(0);
          pending = { onEvent, resolve, reject };
        }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    pending = null;
    clearLiveChat(CHAT_ID);
    resetChatCacheState();
  });

  it('keeps generated prose out of the cache until the server commits it', async () => {
    const { result, queryClient } = renderHookWithQueryClient(() => useSendMessageWithRuntime());

    act(() => {
      void result.current.sendChatMessage({ message: 'Hello there' });
    });
    await waitFor(() => expect(mockConsumeSseXhr).toHaveBeenCalledOnce());

    expect(rows(queryClient)).toEqual([
      expect.objectContaining({ role: 'user', message: 'Hello there' }),
      expect.objectContaining({ role: 'assistant', message: '', isStreaming: true }),
    ]);
    expect(result.current.generation).toMatchObject({ stage: 'preparing' });

    act(() => {
      pending?.onEvent({
        version: 1,
        generationId: 'uuid-1',
        sequence: 1,
        type: 'generation.phase_changed',
        payload: { type: 'generation.phase_changed', phase: 'saving' },
      });
    });
    await waitFor(() => expect(result.current.generation).toMatchObject({ stage: 'running' }));

    act(() => {
      pending?.onEvent({
        version: 1,
        type: 'generation.committed',
        generationId: 'uuid-1',
        sequence: 2,
        payload: {
          type: 'generation.committed',
          message: committedMessage,
        },
      });
      pending?.resolve();
    });

    await waitFor(() => expect(result.current.generation).toBeNull());
    expect(rows(queryClient)).toEqual([
      expect.objectContaining({ role: 'user', message: 'Hello there' }),
      expect.objectContaining({ role: 'assistant', message: 'A durable reply.' }),
    ]);
    expect(mockImpactAsync).toHaveBeenCalledOnce();
  });

  it('keeps the user message and exposes a retry state when generation fails', async () => {
    const { result, queryClient } = renderHookWithQueryClient(() => useSendMessageWithRuntime());
    mockConsumeSseXhr.mockRejectedValue(new Error('generation failed'));

    await act(async () => {
      await result.current.sendChatMessage({ message: 'Hello there' }).catch(() => undefined);
    });

    expect(rows(queryClient)).toEqual([
      expect.objectContaining({ role: 'user', message: 'Hello there' }),
    ]);
    expect(result.current.generation).toMatchObject({
      stage: 'failed',
      error: 'generation failed',
      retryInput: { message: 'Hello there' },
    });
    expect(mockImpactAsync).not.toHaveBeenCalled();
  });

  it('resends an offline message instead of retrying a generation the server never received', async () => {
    const { result, queryClient } = renderHookWithQueryClient(() => useSendMessageWithRuntime());
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: false });

    await act(async () => {
      await result.current
        .sendChatMessage({ message: 'Send me when online' })
        .catch(() => undefined);
    });

    expect(result.current.generation).toMatchObject({
      stage: 'failed',
      retryInput: { message: 'Send me when online' },
    });
    expect(mockConsumeSseXhr).not.toHaveBeenCalled();

    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: true });
    act(() => result.current.retryLastGeneration());
    await waitFor(() => expect(mockConsumeSseXhr).toHaveBeenCalledOnce());
    expect(mockConsumeSseXhr.mock.calls[0]?.[0]).toMatchObject({
      url: `http://localhost:4040/api/chats/${CHAT_ID}/stream`,
    });
    expect(rows(queryClient)).toEqual([
      expect.objectContaining({ role: 'user', message: 'Send me when online' }),
      expect.objectContaining({ role: 'assistant', isStreaming: true }),
    ]);

    await act(async () => {
      pending?.onEvent({
        version: 1,
        generationId: 'uuid-1',
        sequence: 1,
        type: 'generation.failed',
        payload: { type: 'generation.failed', message: 'test cleanup' },
      });
      pending?.resolve();
    });
  });

  it('turns a durable generation failure into the failed generation state', async () => {
    const { result } = renderHookWithQueryClient(useSendMessageWithRuntime);
    let sendPromise: Promise<void> | undefined;

    act(() => {
      sendPromise = result.current.sendChatMessage({ message: 'Hello there' });
    });
    await waitFor(() => expect(mockConsumeSseXhr).toHaveBeenCalledOnce());

    await act(async () => {
      try {
        pending?.onEvent({
          version: 1,
          generationId: 'uuid-1',
          sequence: 1,
          type: 'generation.failed',
          payload: { type: 'generation.failed', message: 'durable failure' },
        });
        pending?.resolve();
      } catch (error) {
        pending?.reject(error instanceof Error ? error : new Error(String(error)));
      }
      await sendPromise?.catch(() => undefined);
    });

    await waitFor(() => expect(result.current.generation?.stage).toBe('failed'));
    expect(result.current.generation?.error).toBe('durable failure');
  });

  it('reduces phase and cancellation events through the shared client reducer', async () => {
    const { result } = renderHookWithQueryClient(useSendMessageWithRuntime);

    act(() => {
      void result.current.sendChatMessage({ message: 'Stop this reply' });
    });
    await waitFor(() => expect(mockConsumeSseXhr).toHaveBeenCalledOnce());

    act(() => {
      pending?.onEvent({
        version: 1,
        generationId: 'uuid-1',
        sequence: 1,
        type: 'generation.phase_changed',
        payload: { type: 'generation.phase_changed', phase: 'preparing' },
      });
      pending?.onEvent({
        version: 1,
        generationId: 'uuid-1',
        sequence: 2,
        type: 'generation.phase_changed',
        payload: { type: 'generation.phase_changed', phase: 'cancel_requested' },
      });
      pending?.onEvent({
        version: 1,
        generationId: 'uuid-1',
        sequence: 3,
        type: 'generation.cancelled',
        payload: { type: 'generation.cancelled' },
      });
      pending?.resolve();
    });

    // A terminal phase (committed or cancelled) clears the generation
    // rather than leaving a lingering cancelled-stage object — same as
    // every other terminal-phase assertion in this file and in
    // use-regenerate-message.test.tsx / use-chat-generation.test.tsx.
    await waitFor(() => expect(result.current.generation).toBeNull());
  });

  it('refetches persisted messages when a tool requires confirmation', async () => {
    const { result, queryClient } = renderHookWithQueryClient(() => useSendMessageWithRuntime());
    queryClient.setQueryData(chatKeys.messages(CHAT_ID), []);

    act(() => {
      void result.current.sendChatMessage({ message: 'Create a collection.' });
    });
    await waitFor(() => expect(mockConsumeSseXhr).toHaveBeenCalledOnce());

    act(() => {
      pending?.onEvent({
        version: 1,
        generationId: 'uuid-1',
        sequence: 1,
        type: 'confirmation.required',
        payload: {
          type: 'confirmation.required',
          call: {
            id: 'call-1',
            name: 'create_collection',
            arguments: '{}',
            turnId: 'uuid-1:0',
            iteration: 0,
          },
        },
      });
    });

    await waitFor(() =>
      expect(queryClient.getQueryState(chatKeys.messages(CHAT_ID))?.isInvalidated).toBe(true),
    );
  });
});
