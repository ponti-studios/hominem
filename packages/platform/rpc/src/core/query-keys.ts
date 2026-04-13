/**
 * Shared query key factory for React Query.
 *
 * Single source of truth consumed by both web and mobile.
 * Keys follow the pattern: [domain, operation, ...params]
 *
 * This eliminates the divergence where web used ['chats', 'list']
 * and mobile used ['resumableSessions'] for the same data.
 */

export const queryKeys = {
  // ─── Notes ───────────────────────────────────────────────────────────
  notes: {
    all: ['notes'] as const,
    // Prefix keys — use these for invalidateQueries to catch all variants
    lists: () => ['notes', 'list'] as const,
    feeds: () => ['notes', 'feed'] as const,
    // Specific keys — use these when registering queries (queryKey in useQuery/useInfiniteQuery)
    list: (options: Record<string, unknown>) => ['notes', 'list', options] as const,
    feed: (options: Record<string, unknown>) => ['notes', 'feed', options] as const,
    detail: (id: string) => ['notes', 'detail', id] as const,
    search: (query: string) => ['notes', 'search', query] as const,
  },

  // ─── Chats ───────────────────────────────────────────────────────────
  chats: {
    all: ['chats'] as const,
    list: ['chats', 'list'] as const,
    detail: (chatId: string) => ['chats', 'detail', chatId] as const,
    messages: (chatId: string, limit = 50) =>
      ['chats', 'messages', { chatId, limit }] as const,
    sessions: ['chats', 'sessions'] as const,
    archived: ['chats', 'archived'] as const,
  },

  // ─── Files ───────────────────────────────────────────────────────────
  files: {
    all: ['files'] as const,
    list: ['files', 'list'] as const,
    detail: (fileId: string) => ['files', 'detail', fileId] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
