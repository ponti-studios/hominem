import { useApiClient } from '@hominem/rpc/react';
import type { NotesSearchOutput } from '@hominem/rpc/types';
import { useQuery } from '@tanstack/react-query';

import { noteKeys } from './query-keys';

export function useNoteSearch(query: string, enabled = true) {
  const client = useApiClient();

  return useQuery<NotesSearchOutput>({
    queryKey: noteKeys.search(query),
    queryFn: async () => client.notes.search({ query, limit: 8 }),
    enabled: enabled && query.trim().length > 0,
    staleTime: 30_000,
  });
}
