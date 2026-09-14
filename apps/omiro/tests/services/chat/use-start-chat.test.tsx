// @vitest-environment jsdom
import type { GenerationEvent } from '@hominem/chat';
import type { Chat, ChatMessageDto } from '@hominem/rpc/types';
import { waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { chatKeys } from '~/services/notes/query-keys';

import { streamFromRequest } from '../../mocks/chat-transport';
import { mockMmkvModule } from '../../mocks/mmkv';
import { renderHookWithQueryClient } from '../../utils/render-hook';

const mockImpactAsync = vi.fn().mockResolvedValue(undefined);
const mockPlayAudioReply = vi.fn();
const mockRandomUUID = vi.fn();
const mockGetAuthHeaders = vi.fn().mockResolvedValue({});
const mockTransportRequest = vi.fn();

const chat = {
  id: 'chat-1',
  userId: 'user-1',
  title: 'Test',
  archivedAt: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
} satisfies Chat;

const userMessage = {
  id: 'user-1',
  chatId: 'chat-1',
  userId: 'user-1',
  role: 'user',
  content: 'Hello',
  files: null,
  toolCalls: null,
  reasoning: null,
  parentMessageId: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
} satisfies ChatMessageDto;

const committedMessageWithAudio = {
  id: 'assistant-1',
  chatId: 'chat-1',
  userId: 'user-1',
  role: 'assistant',
  content: 'A durable reply.',
  files: [{ type: 'audio', url: 'https://example.com/reply.m4a', mimeType: 'audio/mp4' }],
  toolCalls: null,
  reasoning: null,
  parentMessageId: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
} satisfies ChatMessageDto;

vi.mock('~/services/storage/mmkv', () => mockMmkvModule());
vi.mock('expo-crypto', () => ({ randomUUID: mockRandomUUID }));
vi.mock('expo-haptics', () => ({
  impactAsync: mockImpactAsync,
  ImpactFeedbackStyle: { Light: 'light' },
}));
vi.mock('~/components/media/audio-playback.service', () => ({
  playAudioReply: mockPlayAudioReply,
}));
vi.mock('~/services/auth/auth-provider', () => ({
  useAuth: () => ({ getAuthHeaders: mockGetAuthHeaders }),
}));
vi.mock('@react-native-community/netinfo', () => ({
  default: { fetch: vi.fn().mockResolvedValue({ isConnected: true }) },
}));
vi.mock('@hominem/chat/transport/xhr', () => ({
  xhrChatTransport: () => ({
    request: mockTransportRequest,
    stream: streamFromRequest(mockTransportRequest),
  }),
}));
vi.mock('~/services/chat/use-chat-messages', () => ({
  toMessageOutput: (message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    files?: { type: string; url: string }[] | null;
  }) => {
    const audioFile = message.files?.find((file) => file.type === 'audio');
    return {
      id: message.id,
      role: message.role,
      message: message.content,
      audio: audioFile ? { url: audioFile.url } : null,
    };
  },
}));
vi.mock('~/services/inbox/inbox-refresh', () => ({ invalidateInboxQueries: vi.fn() }));
vi.mock('~/constants', () => ({ API_BASE_URL: 'http://localhost:4040' }));

const { useStartChat } = await import('~/services/chat/use-start-chat');
const { takeGenerationHandoff } = await import('~/services/chat/generation-handoff');

describe('useStartChat', () => {
  beforeEach(() => {
    mockRandomUUID.mockReturnValue('generation-1');
    mockTransportRequest.mockImplementation(async () => {
      const event: GenerationEvent = {
        version: 1,
        type: 'generation.accepted',
        generationId: 'generation-1',
        sequence: 1,
        payload: {
          type: 'generation.accepted',
          chatId: 'chat-1',
          chat,
          userMessage,
        },
      };
      return new Response(`data: ${JSON.stringify(event)}\n\n`);
    });
  });

  afterEach(() => vi.clearAllMocks());

  it('reports the chat only after the durable user message is accepted', async () => {
    const { result, queryClient } = renderHookWithQueryClient(() => useStartChat());
    const onAccepted = vi.fn();

    await act(async () => {
      await result.current.startChat({ title: 'Test', message: 'Hello', onAccepted });
    });

    await waitFor(() => expect(onAccepted).toHaveBeenCalledOnce());
    expect(onAccepted).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ chatId: 'chat-1' }) }),
    );
    expect(queryClient.getQueryData(chatKeys.messages('chat-1'))).toEqual([
      expect.objectContaining({ id: 'user-1', message: 'Hello' }),
    ]);
  });

  it('hands off the live controller with the accepted userMessageId', async () => {
    const { result } = renderHookWithQueryClient(() => useStartChat());

    await act(async () => {
      await result.current.startChat({ title: 'Test', message: 'Hello' });
    });

    const handoff = takeGenerationHandoff('chat-1');
    expect(handoff?.userMessageId).toBe('user-1');
    expect(handoff?.controller.state.generationId).toBe('generation-1');
  });

  it('gives the first assistant reply in a new chat the same haptic + audio treatment as any other reply', async () => {
    mockTransportRequest.mockImplementationOnce(async () => {
      const accepted: GenerationEvent = {
        version: 1,
        type: 'generation.accepted',
        generationId: 'generation-1',
        sequence: 1,
        payload: { type: 'generation.accepted', chatId: 'chat-1', chat, userMessage },
      };
      const committed: GenerationEvent = {
        version: 1,
        type: 'generation.committed',
        generationId: 'generation-1',
        sequence: 2,
        payload: { type: 'generation.committed', message: committedMessageWithAudio },
      };
      const body = [accepted, committed]
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join('');
      return new Response(body);
    });

    const { result, queryClient } = renderHookWithQueryClient(() => useStartChat());

    await act(async () => {
      await result.current.startChat({ title: 'Test', message: 'Hello' });
    });

    expect(queryClient.getQueryData(chatKeys.messages('chat-1'))).toEqual([
      expect.objectContaining({ id: 'user-1', message: 'Hello' }),
      expect.objectContaining({ id: 'assistant-1', message: 'A durable reply.' }),
    ]);
    expect(mockImpactAsync).toHaveBeenCalledOnce();
    expect(mockPlayAudioReply).toHaveBeenCalledWith('assistant-1', 'https://example.com/reply.m4a');
  });

  it('does not duplicate the assistant reply if commit is delivered more than once', async () => {
    mockTransportRequest.mockImplementationOnce(async () => {
      const accepted: GenerationEvent = {
        version: 1,
        type: 'generation.accepted',
        generationId: 'generation-1',
        sequence: 1,
        payload: { type: 'generation.accepted', chatId: 'chat-1', chat, userMessage },
      };
      const committedMessage = { ...committedMessageWithAudio, files: null };
      const committedOnce: GenerationEvent = {
        version: 1,
        type: 'generation.committed',
        generationId: 'generation-1',
        sequence: 2,
        payload: { type: 'generation.committed', message: committedMessage },
      };
      // A distinct sequence so the client's own dedupe (keyed on
      // generationId:sequence) doesn't swallow this before it ever reaches
      // applyGenerationCommitted -- the cache-level by-message-id dedupe is
      // what's actually under test here.
      const committedAgain: GenerationEvent = { ...committedOnce, sequence: 3 };
      const body = [accepted, committedOnce, committedAgain]
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join('');
      return new Response(body);
    });

    const { result, queryClient } = renderHookWithQueryClient(() => useStartChat());

    await act(async () => {
      await result.current.startChat({ title: 'Test', message: 'Hello' });
    });

    expect(queryClient.getQueryData(chatKeys.messages('chat-1'))).toEqual([
      expect.objectContaining({ id: 'user-1', message: 'Hello' }),
      expect.objectContaining({ id: 'assistant-1', message: 'A durable reply.' }),
    ]);
    expect(mockImpactAsync).toHaveBeenCalledTimes(2);
    expect(mockPlayAudioReply).not.toHaveBeenCalled();
  });

  it('surfaces a durable generation failure from the stream', async () => {
    mockTransportRequest.mockImplementationOnce(async () => {
      const event: GenerationEvent = {
        version: 1,
        generationId: 'generation-1',
        sequence: 1,
        type: 'generation.failed',
        payload: { type: 'generation.failed', message: 'start failed' },
      };
      return new Response(`data: ${JSON.stringify(event)}\n\n`);
    });

    const { result } = renderHookWithQueryClient(() => useStartChat());
    await expect(result.current.startChat({ title: 'Test', message: 'Hello' })).rejects.toThrow(
      'start failed',
    );
    expect(mockTransportRequest).toHaveBeenCalledOnce();
  });
});
