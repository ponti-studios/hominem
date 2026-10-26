import type { ChatMessageItem } from '@hominem/chat';
import { useEffect, useMemo } from 'react';

import { type LiveChat, retireLiveTurn, streamingIdFor, useLiveChat } from './live-turn-store';

// The rows the chat shows: the server's persisted messages with the live turn
// laid over them. Every id appears at most once, and a bubble keeps the same
// render key from the first word of the reply to the final message.
export function deriveChatRows(persisted: ChatMessageItem[], live: LiveChat): ChatMessageItem[] {
  const { turn, keys } = live;
  if (!turn && keys.size === 0) {
    return persisted;
  }

  const persistedIds = new Set(persisted.map((message) => message.id));
  // The placeholder shows from send, so there is no dead air before the first word.
  const streaming = turn?.reply === 'streaming' || turn?.reply === 'pending';
  const rows: ChatMessageItem[] = [];

  for (const message of persisted) {
    if (turn?.replacesMessageId === message.id) {
      continue;
    }
    // The reply landed server-side before this device committed it; the
    // streaming bubble is that reply, so showing both would be two bubbles.
    if (streaming && message.role === 'assistant' && !turn.knownIds.has(message.id)) {
      continue;
    }
    const key = keys.get(message.id);
    rows.push(key && key !== message.renderKey ? { ...message, renderKey: key } : message);
  }

  if (turn?.user && !persistedIds.has(turn.user.id)) {
    // Anything persisted since the turn began belongs to its reply, so the
    // user's message goes ahead of it, not after.
    const firstNew = rows.findIndex((row) => !turn.knownIds.has(row.id));
    rows.splice(firstNew === -1 ? rows.length : firstNew, 0, turn.user);
  }

  if (turn?.committed && !persistedIds.has(turn.committed.id)) {
    rows.push(turn.committed);
  }

  if (turn && streaming) {
    rows.push({
      id: streamingIdFor(turn.generationId),
      renderKey: streamingIdFor(turn.generationId),
      role: 'assistant',
      message: '',
      createdAt: turn.replyStartedAt,
      chatId: turn.user?.chatId ?? persisted[0]?.chatId ?? '',
      reasoning: null,
      toolCalls: null,
      isStreaming: true,
    });
  }

  return rows;
}

export function useChatRows(chatId: string, persisted: ChatMessageItem[]) {
  const live = useLiveChat(chatId);

  // Once the server list has the finished turn's messages, the overlay copies are done.
  useEffect(() => {
    const { turn } = live;
    if (!turn || turn.reply === 'pending' || turn.reply === 'streaming') {
      return;
    }
    const ids = new Set(persisted.map((message) => message.id));
    const userCaughtUp = !turn.user || ids.has(turn.user.id);
    const replyCaughtUp = !turn.committed || ids.has(turn.committed.id);
    if (userCaughtUp && replyCaughtUp) {
      retireLiveTurn(chatId, turn.generationId);
    }
  }, [chatId, live, persisted]);

  return useMemo(() => deriveChatRows(persisted, live), [persisted, live]);
}
