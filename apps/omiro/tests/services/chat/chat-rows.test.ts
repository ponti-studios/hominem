import type { ChatMessageItem } from '@hominem/chat';
import { afterEach, describe, expect, it } from 'vitest';

import { deriveChatRows } from '~/services/chat/chat-rows';
import {
  acceptLiveUserMessage,
  beginLiveTurn,
  clearLiveChat,
  dropLiveReply,
  finishLiveReply,
  getLiveChat,
  startLiveReply,
  streamingIdFor,
} from '~/services/chat/live-turn-store';

const CHAT_ID = 'chat-1';
const GEN = 'gen-1';

function message(
  id: string,
  role: 'user' | 'assistant',
  text = id,
  extra: Partial<ChatMessageItem> = {},
): ChatMessageItem {
  return {
    id,
    renderKey: id,
    role,
    message: text,
    createdAt: '2026-01-01T00:00:00.000Z',
    chatId: CHAT_ID,
    reasoning: null,
    toolCalls: null,
    isStreaming: false,
    ...extra,
  };
}

const rowsFor = (persisted: ChatMessageItem[]) => deriveChatRows(persisted, getLiveChat(CHAT_ID));
const ids = (rows: ChatMessageItem[]) => rows.map((row) => row.id);

afterEach(() => clearLiveChat(CHAT_ID));

describe('deriveChatRows', () => {
  it('drops the placeholder when the reply ends without a final message', () => {
    beginLiveTurn(CHAT_ID, { generationId: GEN, knownIds: [], user: message('u', 'user') });
    dropLiveReply(CHAT_ID, GEN);
    expect(ids(rowsFor([]))).toEqual(['u']);
  });

  it('returns the persisted list untouched when nothing is live', () => {
    const persisted = [message('u1', 'user')];
    expect(rowsFor(persisted)).toBe(persisted);
  });

  it('shows the optimistic user message and then one streaming bubble', () => {
    const persisted = [message('old', 'assistant')];
    beginLiveTurn(CHAT_ID, {
      generationId: GEN,
      knownIds: ['old'],
      user: message('optimistic', 'user'),
    });
    // The thinking placeholder is the same bubble the reply streams into.
    expect(ids(rowsFor(persisted))).toEqual(['old', 'optimistic', streamingIdFor(GEN)]);

    startLiveReply(CHAT_ID, GEN, () => ['old']);
    expect(ids(rowsFor(persisted))).toEqual(['old', 'optimistic', streamingIdFor(GEN)]);
    expect(rowsFor(persisted).at(-1)?.isStreaming).toBe(true);
  });

  it('never shows a second bubble when a refetch lands the reply before the commit', () => {
    beginLiveTurn(CHAT_ID, {
      generationId: GEN,
      knownIds: [],
      user: message('optimistic', 'user'),
    });
    startLiveReply(CHAT_ID, GEN, () => []);

    const refetched = [message('u1', 'user'), message('a1', 'assistant', 'whole reply')];
    const rows = rowsFor(refetched);
    expect(rows.filter((row) => row.role === 'assistant')).toHaveLength(1);
    expect(rows.at(-1)?.isStreaming).toBe(true);
  });

  it('keeps the streaming bubble through a mid-stream refetch', () => {
    beginLiveTurn(CHAT_ID, {
      generationId: GEN,
      knownIds: [],
      user: message('optimistic', 'user'),
    });
    startLiveReply(CHAT_ID, GEN, () => []);
    const before = rowsFor([]).find((row) => row.isStreaming);
    const after = rowsFor([message('u1', 'user')]).find((row) => row.isStreaming);
    expect(after?.renderKey).toBe(before?.renderKey);
  });

  it('keeps the user bubble key when the server assigns its id', () => {
    beginLiveTurn(CHAT_ID, {
      generationId: GEN,
      knownIds: [],
      user: message('optimistic', 'user'),
    });
    acceptLiveUserMessage(CHAT_ID, GEN, message('u1', 'user'));

    const live = rowsFor([]);
    expect(live[0]).toMatchObject({ id: 'u1', renderKey: 'optimistic' });
    const persisted = rowsFor([message('u1', 'user')]);
    expect(persisted.filter((row) => row.role === 'user')).toHaveLength(1);
    expect(persisted[0]?.renderKey).toBe('optimistic');
  });

  it('hands the streaming bubble to the committed message without a gap or a remount', () => {
    beginLiveTurn(CHAT_ID, { generationId: GEN, knownIds: [], user: message('u1', 'user') });
    startLiveReply(CHAT_ID, GEN, () => []);
    const streamingKey = rowsFor([message('u1', 'user')]).at(-1)?.renderKey;

    finishLiveReply(CHAT_ID, GEN, message('a1', 'assistant', 'final'));
    // Persisted list has not caught up yet: the held commit fills in.
    const held = rowsFor([message('u1', 'user')]);
    expect(held.at(-1)).toMatchObject({ id: 'a1', renderKey: streamingKey, isStreaming: false });

    // Persisted list caught up: still exactly one assistant row, same key.
    const caughtUp = rowsFor([message('u1', 'user'), message('a1', 'assistant', 'final')]);
    expect(caughtUp.filter((row) => row.role === 'assistant')).toHaveLength(1);
    expect(caughtUp.at(-1)?.renderKey).toBe(streamingKey);
  });

  it('hides the message a regeneration replaces until the new reply lands', () => {
    const persisted = [message('u1', 'user'), message('a1', 'assistant', 'old')];
    beginLiveTurn(CHAT_ID, {
      generationId: GEN,
      knownIds: ['u1', 'a1'],
      replacesMessageId: 'a1',
    });
    startLiveReply(CHAT_ID, GEN, () => ['u1', 'a1']);
    expect(ids(rowsFor(persisted))).toEqual(['u1', streamingIdFor(GEN)]);
  });

  it('hands a paused tool confirmation over to the persisted checkpoint message', () => {
    beginLiveTurn(CHAT_ID, { generationId: GEN, knownIds: ['u1'], user: message('u1', 'user') });
    startLiveReply(CHAT_ID, GEN, () => ['u1']);
    dropLiveReply(CHAT_ID, GEN, 'a-checkpoint');

    const rows = rowsFor([
      message('u1', 'user'),
      message('a-checkpoint', 'assistant', 'pls confirm'),
    ]);
    expect(rows.filter((row) => row.role === 'assistant')).toHaveLength(1);
    expect(rows.at(-1)).toMatchObject({ id: 'a-checkpoint', renderKey: streamingIdFor(GEN) });
  });
});

describe('deriveChatRows ordering', () => {
  it('keeps the optimistic user message ahead of a reply that is already persisted', () => {
    beginLiveTurn(CHAT_ID, {
      generationId: GEN,
      knownIds: ['old'],
      user: message('u-opt', 'user'),
    });
    // Reply ended without a final message here, so the persisted one shows in place.
    dropLiveReply(CHAT_ID, GEN);
    const rows = rowsFor([message('old', 'assistant'), message('a1', 'assistant', 'reply')]);
    expect(ids(rows)).toEqual(['old', 'u-opt', 'a1']);
  });
});
