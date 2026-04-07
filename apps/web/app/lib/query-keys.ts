/**
 * Re-export the shared query key factory from @hominem/rpc.
 *
 * This replaces the local key definitions that were diverging
 * from mobile. Both apps now share a single source of truth.
 */
import { queryKeys } from '@hominem/rpc/react';

export const chatQueryKeys = {
  list: queryKeys.chats.list,
  get: (chatId: string) => queryKeys.chats.detail(chatId),
  messages: (chatId: string) => queryKeys.chats.messages(chatId),
  note: (noteId: string) => ['chats', 'note', noteId] as const,
  sidebarList: ['chats', 'sidebar', 'list'] as const,
};

export const notesQueryKeys = {
  list: (options: Record<string, unknown> = {}) => queryKeys.notes.list(options),
  feed: (options: Record<string, unknown> = {}) => queryKeys.notes.feed(options),
  detail: (id: string) => queryKeys.notes.detail(id),
  search: (query: string) => queryKeys.notes.search(query),
};

export const filesQueryKeys = {
  list: queryKeys.files.list,
  detail: (fileId: string) => queryKeys.files.detail(fileId),
};
