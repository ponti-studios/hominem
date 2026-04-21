import { useApiClient } from '@hakumi/rpc/react';
import type { NotesSearchOutput } from '@hakumi/rpc/types';
import { useInfiniteQuery } from '@tanstack/react-query';

import { noteKeys } from './query-keys';

export function useNoteSearch(query: string, enabled = true) {
  const client = useApiClient();

  return useInfiniteQuery<NotesSearchOutput, Error, NotesSearchOutput, readonly unknown[], string | null>({
    queryKey: noteKeys.search(query),
    enabled: enabled && query.trim().length > 0,
    staleTime: 30_000,
    initialPageParam: null,
    queryFn: async ({ pageParam }) =>
      client.notes.search({
        query,
        limit: 8,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (data) => {
      const notes = data.pages.flatMap((page) => page.notes);
      return {
        pages: data.pages,
        pageParams: data.pageParams,
        notes,
        nextCursor: data.pages.at(-1)?.nextCursor ?? null,
      } as NotesSearchOutput & { pages: typeof data.pages; pageParams: typeof data.pageParams };
    },
  });
}
