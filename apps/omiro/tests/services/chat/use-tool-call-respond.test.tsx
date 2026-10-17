// @vitest-environment jsdom
import type { GenerationEvent } from '@hominem/chat';
import type { GenerationClientInputEvent } from '@hominem/chat/client';
import type { ChatMessageDto } from '@hominem/rpc/types';
import { useQueryClient } from '@tanstack/react-query';
import { act } from '@testing-library/react';
import { useCallback } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ChatGenerationState } from '~/services/chat/chat-generation';

import { streamFromRequest } from '../../mocks/chat-transport';
import { mockMmkvModule } from '../../mocks/mmkv';
import { renderHookWithQueryClient } from '../../utils/render-hook';

const mockTransport = { request: vi.fn(), stream: vi.fn() };
mockTransport.stream.mockImplementation(streamFromRequest((input) => mockTransport.request(input)));
const mockGetAuthHeaders = vi.fn().mockResolvedValue({ cookie: 'session=test' });
const mockSyncAfterChatTasks = vi.fn();

vi.mock('~/services/tasks/sync-chat-tasks', () => ({
  syncAfterChatTasks: mockSyncAfterChatTasks,
}));
vi.mock('~/services/storage/mmkv', () => mockMmkvModule());
vi.mock('~/services/auth/auth-provider', () => ({
  useAuth: () => ({ getAuthHeaders: mockGetAuthHeaders }),
}));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
}));
vi.mock('~/components/media/audio-playback.service', () => ({ playAudioReply: vi.fn() }));
vi.mock('~/services/chat/use-chat-messages', () => ({
  toMessageOutput: (message: { id: string; role: 'user' | 'assistant'; content: string }) => ({
    id: message.id,
    renderKey: message.id,
    role: message.role,
    message: message.content,
    createdAt: new Date().toISOString(),
    chatId: 'chat-1',
    reasoning: null,
    toolCalls: null,
    isStreaming: false,
  }),
}));
vi.mock('~/constants', () => ({ API_BASE_URL: 'http://localhost:4040' }));
vi.mock('@hominem/chat/transport/xhr', () => ({
  xhrChatTransport: () => mockTransport,
}));

const [{ useToolCallRespond }, { useChatGeneration }, { handleChatGenerationEvent }] =
  await Promise.all([
    import('~/services/chat/use-tool-call-respond'),
    import('~/services/chat/use-chat-generation'),
    import('~/services/chat/chat-cache'),
  ]);

function useToolCallRespondWithRuntime() {
  const queryClient = useQueryClient();
  const onGenerationEvent = useCallback(
    (event: GenerationClientInputEvent, current: ChatGenerationState) =>
      handleChatGenerationEvent({ queryClient, chatId: 'chat-1', generation: current, event }),
    [queryClient],
  );
  const generation = useChatGeneration({
    chatId: 'chat-1',
    getAuthHeaders: mockGetAuthHeaders,
    onGenerationEvent,
  });
  const responder = useToolCallRespond({ chatId: 'chat-1', generation });
  return { ...responder, setGeneration: generation.setGeneration };
}

const waitingGeneration = {
  id: 'generation-1',
  chatId: 'chat-1',
  stage: 'awaiting_confirmation' as const,
  lastDurableSequence: 4,
};

const committedMessage = {
  id: 'assistant-1',
  chatId: 'chat-1',
  userId: 'user-1',
  role: 'assistant',
  content: 'Done',
  files: null,
  toolCalls: null,
  reasoning: null,
  parentMessageId: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
} satisfies ChatMessageDto;

function committedEvent(): GenerationEvent {
  return {
    version: 1,
    generationId: 'generation-1',
    sequence: 5,
    type: 'generation.committed',
    payload: { type: 'generation.committed', message: committedMessage },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  mockTransport.request.mockReset();
});

describe('useToolCallRespond', () => {
  it('posts the decision, drains the SSE response, and invalidates chat data', async () => {
    mockTransport.request.mockResolvedValueOnce(
      new Response(`data: ${JSON.stringify(committedEvent())}\n\ndata: [DONE]\n\n`),
    );
    const { result, queryClient } = renderHookWithQueryClient(() =>
      useToolCallRespondWithRuntime(),
    );
    await act(async () => result.current.setGeneration(waitingGeneration));
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.respond({
        messageId: 'message-1',
        toolCallId: 'call-1',
        approved: true,
      });
    });

    expect(mockTransport.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://localhost:4040/api/chats/chat-1/messages/message-1/tool-calls/call-1/respond',
        init: expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"approved":true'),
        }),
      }),
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['chats', 'messages', { chatId: 'chat-1', limit: 50 }],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['chats', 'detail', 'chat-1'],
    });
    expect(mockSyncAfterChatTasks).toHaveBeenCalledOnce();
    expect(result.current.isResponding).toBe(false);
  });

  it('resets responding state and invalidates data when the response fails', async () => {
    mockTransport.request.mockRejectedValue(new Error('network error'));
    const { result, queryClient } = renderHookWithQueryClient(() =>
      useToolCallRespondWithRuntime(),
    );
    await act(async () => result.current.setGeneration(waitingGeneration));
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await expect(
        result.current.respond({
          messageId: 'message-1',
          toolCallId: 'call-1',
          approved: false,
        }),
      ).rejects.toThrow('network error');
    });

    expect(result.current.isResponding).toBe(false);
    expect(invalidateQueries).toHaveBeenCalledTimes(3);
  });
});
