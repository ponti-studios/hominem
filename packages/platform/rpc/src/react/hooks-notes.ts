/**
 * Shared React Query mutation hooks and utilities for notes.
 * Consolidates cache invalidation and optimistic update patterns
 * used across web and mobile apps.
 */

import type { QueryClient } from '@tanstack/react-query';

import { notesQueryKeys } from '../core/query-keys';

/**
 * Default feed limit used across apps
 */
export const DEFAULT_NOTES_FEED_LIMIT = 20;

/**
 * Invalidate all note-related query caches.
 * Call this in mutation onSuccess handlers to refresh data.
 */
export async function invalidateNotesCaches(
  queryClient: QueryClient,
  options: {
    /** Invalidate list queries */
    lists?: boolean;
    /** Invalidate feed queries */
    feed?: boolean;
    /** Invalidate specific note detail by ID */
    details?: string[];
  } = {},
): Promise<void> {
  const { lists = true, feed = true, details = [] } = options;

  const invalidations: Promise<void>[] = [];

  if (lists) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: notesQueryKeys.list() }));
  }

  if (feed) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: notesQueryKeys.feed() }));
  }

  for (const noteId of details) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: notesQueryKeys.detail(noteId) }));
  }

  await Promise.all(invalidations);
}

/**
 * Standard mutation success handler that invalidates note caches.
 * Use this in the onSuccess callback of note mutations.
 *
 * @example
 * ```ts
 * useMutation({
 *   mutationFn: (input) => client.notes.update(input),
 *   onSuccess: async (data) => {
 *     await createNotesMutationSuccessHandler(queryClient, data.id);
 *   },
 * });
 * ```
 */
export async function createNotesMutationSuccessHandler(
  queryClient: QueryClient,
  updatedNoteId?: string,
): Promise<void> {
  await invalidateNotesCaches(queryClient, {
    lists: true,
    feed: true,
    details: updatedNoteId ? [updatedNoteId] : [],
  });
}
