// @vitest-environment jsdom
import type { GenerationClientInputEvent } from '@hominem/chat/client';
import type { ChatMessageDto } from '@hominem/rpc/types';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatMessageItem } from '~/components/chat';
import { handleChatGenerationEvent } from '~/services/chat/chat-cache';
import type { ChatGenerationState } from '~/services/chat/chat-generation';
import { getStreamingMessageText } from '~/services/chat/streaming-text-store';
import { chatKeys } from '~/services/notes/query-keys';

import { mockMmkvModule } from '../../mocks/mmkv';

vi.mock('~/services/storage/mmkv', () => mockMmkvModule());

vi.mock('~/services/tasks/sync-chat-tasks', () => ({ syncAfterChatTasks: vi.fn() }));
vi.mock('~/components/media/audio-playback.service', () => ({ playAudioReply: vi.fn() }));
vi.mock('~/services/chat/use-chat-messages', () => ({
  toMessageOutput: (message: { id: string; role: 'user' | 'assistant'; content: string }) => ({
    id: message.id,
    renderKey: message.id,
    role: message.role,
    message: message.content,
    createdAt: '2026-01-01',
    chatId: 'chat-1',
    reasoning: null,
    toolCalls: null,
    files: null,
  }),
}));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const CHAT_ID = 'chat-1';
const GENERATION_ID = 'gen-1';

const generation: ChatGenerationState = {
  id: GENERATION_ID,
  chatId: CHAT_ID,
  stage: 'running',
  lastDurableSequence: 0,
};

const committed = {
  id: 'assistant-1',
  chatId: CHAT_ID,
  userId: 'user-1',
  role: 'assistant',
  content: 'Hello there, friend.',
  files: null,
  toolCalls: null,
  reasoning: null,
  parentMessageId: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
} satisfies ChatMessageDto;

function textDelta(text: string): GenerationClientInputEvent {
  return {
    version: 1,
    type: 'text-delta',
    generationId: GENERATION_ID,
    sequence: null,
    payload: { type: 'text-delta', text },
  };
}

function commit(): GenerationClientInputEvent {
  return {
    version: 1,
    type: 'generation.committed',
    generationId: GENERATION_ID,
    sequence: 2,
    payload: { type: 'generation.committed', message: committed },
  };
}

describe('chat cache paced streaming', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reveals a burst of deltas over several ticks and commits after the queue drains', () => {
    const queryClient = new QueryClient();
    const read = () => queryClient.getQueryData<ChatMessageItem[]>(chatKeys.messages(CHAT_ID));
    const send = (event: GenerationClientInputEvent) =>
      handleChatGenerationEvent({ queryClient, chatId: CHAT_ID, generation, event });

    for (const char of 'Hello there, friend.') {
      send(textDelta(char));
    }
    send(commit());

    // Nothing shown yet and the commit is parked behind the paced reveal.
    expect(read()).toBeUndefined();

    // Words land in the streaming store, not the cache: the list data stays the
    // same array and the provisional row the same object, so the list never
    // re-renders per word.
    vi.advanceTimersByTime(50);
    const rows = read();
    const row = rows?.find((m) => m.isStreaming);
    const partial = getStreamingMessageText(`streaming-${GENERATION_ID}`);
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.length).toBeLessThan('Hello there, friend.'.length);

    vi.advanceTimersByTime(60);
    expect(read()).toBe(rows);
    expect(read()?.find((m) => m.isStreaming)).toBe(row);
    expect(getStreamingMessageText(`streaming-${GENERATION_ID}`).length).toBeGreaterThan(
      partial.length,
    );

    vi.advanceTimersByTime(1000);
    const final = read() ?? [];
    expect(final.some((m) => m.isStreaming)).toBe(false);
    expect(getStreamingMessageText(`streaming-${GENERATION_ID}`)).toBe('');
    expect(final).toEqual([
      expect.objectContaining({ role: 'assistant', message: committed.content }),
    ]);
  });

  it('streams text without whitespace, like Chinese, before the commit', () => {
    const queryClient = new QueryClient();
    const read = () => queryClient.getQueryData<ChatMessageItem[]>(chatKeys.messages(CHAT_ID));
    handleChatGenerationEvent({
      queryClient,
      chatId: CHAT_ID,
      generation,
      event: textDelta('你好，这是一个正在生成的中文回答。'),
    });

    vi.advanceTimersByTime(300);
    const partial = read()?.find((m) => m.isStreaming);
    expect(partial?.message.length).toBeGreaterThan(0);

    // Drain so the module-level queue doesn't leak into the next test.
    handleChatGenerationEvent({ queryClient, chatId: CHAT_ID, generation, event: commit() });
    vi.advanceTimersByTime(5000);
  });

  it('commits right away when nothing is queued', () => {
    const queryClient = new QueryClient();
    handleChatGenerationEvent({ queryClient, chatId: CHAT_ID, generation, event: commit() });
    expect(queryClient.getQueryData<ChatMessageItem[]>(chatKeys.messages(CHAT_ID))).toEqual([
      expect.objectContaining({ message: committed.content }),
    ]);
  });
});
