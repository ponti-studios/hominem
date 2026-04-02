import { useApiClient } from '@hominem/rpc/react';
import type { Note } from '@hominem/rpc/types';
import { useQuery } from '@tanstack/react-query';

import { noteKeys } from './query-keys';

export function useNoteStream({ enabled = true }: { enabled?: boolean } = {}) {
  const client = useApiClient();

  return useQuery<Note[]>({
    queryKey: noteKeys.all,
    queryFn: async () => {
      const response = await client.notes.list({
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        limit: 100,
      });
      return response.notes;
    },
    initialData: [],
    enabled,
  });
}
