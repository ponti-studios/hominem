import type { ChatMessageItem } from '@hominem/chat';
import { useSyncExternalStore } from 'react';

// The one turn currently being sent or answered in a chat -- an overlay on top of
// the server's persisted messages, never written into the query cache.
//
// Why an overlay: the reply that is still arriving and the refetch of the
// persisted list used to share one cache, so a refetch landing mid-stream wiped
// or doubled the provisional bubble. Here the persisted list is only ever what
// the server says, the live turn is only ever what this device is doing right
// now, and `deriveChatRows` merges the two by id.
export const STREAMING_ID_PREFIX = 'streaming-';

export function streamingIdFor(generationId: string) {
  return `${STREAMING_ID_PREFIX}${generationId}`;
}

// pending: sent, no word yet (the thinking placeholder shows). streaming: words
// arriving. done: committed. idle: ended without a final message (cancelled, or
// paused on a confirmation), so no placeholder.
export type LiveReply = 'pending' | 'streaming' | 'done' | 'idle';

export interface LiveTurn {
  generationId: string;
  // Persisted ids at the moment the turn began. While the reply streams, any
  // other persisted assistant message is this very reply landing early (a
  // refetch can beat the client's own commit) and must not show a second bubble.
  knownIds: ReadonlySet<string>;
  // The user's message while it is still optimistic, then the server's version.
  user: ChatMessageItem | null;
  // The message a regeneration replaces; hidden until the new reply commits.
  replacesMessageId: string | null;
  reply: LiveReply;
  replyStartedAt: string;
  // The final reply, held here until the persisted list has caught up so the
  // bubble never disappears between "streaming ended" and "refetch landed".
  committed: ChatMessageItem | null;
}

export interface LiveChat {
  turn: LiveTurn | null;
  // message id -> the render key it already has on screen. A bubble keeps one
  // key from first paint to final message, so the list never remounts it.
  keys: ReadonlyMap<string, string>;
}

const EMPTY: LiveChat = { turn: null, keys: new Map() };

const chats = new Map<string, LiveChat>();
const listeners = new Map<string, Set<() => void>>();

function read(chatId: string): LiveChat {
  return chats.get(chatId) ?? EMPTY;
}

function write(chatId: string, next: LiveChat) {
  chats.set(chatId, next);
  for (const listener of listeners.get(chatId) ?? []) {
    listener();
  }
}

function withKey(keys: ReadonlyMap<string, string>, messageId: string, key: string) {
  if (keys.get(messageId) === key) {
    return keys;
  }
  const next = new Map(keys);
  next.set(messageId, key);
  return next;
}

export function getLiveChat(chatId: string): LiveChat {
  return read(chatId);
}

export function subscribeToLiveChat(chatId: string, listener: () => void) {
  let set = listeners.get(chatId);
  if (!set) {
    set = new Set();
    listeners.set(chatId, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(chatId);
    }
  };
}

export function useLiveChat(chatId: string): LiveChat {
  return useSyncExternalStore(
    (listener) => subscribeToLiveChat(chatId, listener),
    () => read(chatId),
  );
}

export function beginLiveTurn(
  chatId: string,
  input: {
    generationId: string;
    knownIds: Iterable<string>;
    user?: ChatMessageItem | null;
    replacesMessageId?: string | null;
  },
) {
  const current = read(chatId);
  const user = input.user ?? null;
  write(chatId, {
    keys: user ? withKey(current.keys, user.id, user.renderKey ?? user.id) : current.keys,
    turn: {
      generationId: input.generationId,
      knownIds: new Set(input.knownIds),
      user,
      replacesMessageId: input.replacesMessageId ?? null,
      reply: 'pending',
      replyStartedAt: new Date().toISOString(),
      committed: null,
    },
  });
}

// The server confirmed the user's message under its own id. The row keeps the
// key it already had, so the bubble is not remounted or re-announced.
export function acceptLiveUserMessage(
  chatId: string,
  generationId: string,
  accepted: ChatMessageItem,
) {
  const { turn, keys } = read(chatId);
  if (turn?.generationId !== generationId) {
    return;
  }
  const key = turn.user ? (keys.get(turn.user.id) ?? turn.user.id) : accepted.id;
  write(chatId, {
    keys: withKey(keys, accepted.id, key),
    turn: { ...turn, user: { ...accepted, renderKey: key } },
  });
}

// First word of the reply. If this device never saw the turn begin (a stream
// adopted from another screen, or resumed after a relaunch) the turn starts here.
export function startLiveReply(
  chatId: string,
  generationId: string,
  persistedIds: () => Iterable<string>,
) {
  const current = read(chatId);
  if (current.turn?.generationId === generationId) {
    if (current.turn.reply === 'streaming') {
      return;
    }
    write(chatId, { ...current, turn: { ...current.turn, reply: 'streaming' } });
    return;
  }
  write(chatId, {
    keys: current.keys,
    turn: {
      generationId,
      knownIds: new Set(persistedIds()),
      user: null,
      replacesMessageId: null,
      reply: 'streaming',
      replyStartedAt: new Date().toISOString(),
      committed: null,
    },
  });
}

// The reply is final. Its message takes over the bubble that was streaming.
export function finishLiveReply(chatId: string, generationId: string, committed: ChatMessageItem) {
  const { turn, keys } = read(chatId);
  const key = streamingIdFor(generationId);
  const nextKeys = withKey(keys, committed.id, key);
  if (turn?.generationId !== generationId) {
    write(chatId, { turn, keys: nextKeys });
    return;
  }
  write(chatId, {
    keys: nextKeys,
    turn: { ...turn, reply: 'done', committed: { ...committed, renderKey: key } },
  });
}

// The stream ended without a final message (cancelled, failed, or paused on a
// confirmation). `adoptedId` is the persisted message that stands in for it.
export function dropLiveReply(chatId: string, generationId: string, adoptedId?: string) {
  const { turn, keys } = read(chatId);
  const nextKeys = adoptedId ? withKey(keys, adoptedId, streamingIdFor(generationId)) : keys;
  if (turn?.generationId !== generationId) {
    return;
  }
  write(chatId, {
    keys: nextKeys,
    turn: { ...turn, reply: 'idle', replacesMessageId: null },
  });
}

// The persisted list has caught up with a finished turn, so its overlaid copies
// of the user message and reply retire. Left in place they would outlive an edit
// that truncates the conversation and bring the deleted messages back. The render
// keys stay, so the persisted rows take over their bubbles without remounting.
export function retireLiveTurn(chatId: string, generationId: string) {
  const { turn, keys } = read(chatId);
  if (turn?.generationId !== generationId || (!turn.user && !turn.committed)) {
    return;
  }
  write(chatId, { keys, turn: { ...turn, user: null, committed: null } });
}

export function clearLiveChat(chatId: string) {
  if (chats.delete(chatId)) {
    for (const listener of listeners.get(chatId) ?? []) {
      listener();
    }
  }
}
