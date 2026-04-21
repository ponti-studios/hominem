/**
 * Re-export the shared query key factory from @hakumi/rpc.
 *
 * This replaces the local key definitions that were diverging
 * from mobile. Both apps now share a single source of truth.
 */
import { queryKeys } from '@hakumi/rpc/react';

export const chatQueryKeys = {
  list: queryKeys.chats.list,
  get: (chatId: string) => queryKeys.chats.detail(chatId),
  messages: (chatId: string) => queryKeys.chats.messages(chatId),
  note: (noteId: string) => ['chats', 'note', noteId] as const,
  sidebarList: ['chats', 'sidebar', 'list'] as const,
};

export const notesQueryKeys = {
  lists: queryKeys.notes.lists,
  feeds: queryKeys.notes.feeds,
  list: (options: Record<string, unknown>) => queryKeys.notes.list(options),
  feed: (options: Record<string, unknown>) => queryKeys.notes.feed(options),
  detail: (id: string) => queryKeys.notes.detail(id),
  search: (query: string) => queryKeys.notes.search(query),
};
