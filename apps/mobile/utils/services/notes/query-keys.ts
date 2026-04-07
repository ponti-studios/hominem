/**
 * Re-export the shared query key factory from @hominem/rpc.
 *
 * This replaces the local key definitions that were diverging
 * from web. Both apps now share a single source of truth.
 */
import { queryKeys } from '@hominem/rpc/react';

export const noteKeys = {
  all: queryKeys.notes.all,
  list: () => [...queryKeys.notes.all, 'list'] as const,
  feed: (options: Record<string, unknown> = {}) => queryKeys.notes.feed(options),
  detail: (id: string) => queryKeys.notes.detail(id),
} as const;

export const chatKeys = {
  resumableSessions: queryKeys.chats.sessions,
  archivedSessions: queryKeys.chats.archived,
  messages: (chatId: string) => queryKeys.chats.messages(chatId),
  activeChat: (chatId: string | null) => ['chats', 'detail', chatId] as const,
} as const;
