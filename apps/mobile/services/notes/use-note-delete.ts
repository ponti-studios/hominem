import { useApiClient } from '@hominem/rpc/react';
import type { Note } from '@hominem/rpc/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { noteKeys } from './query-keys';

interface UseNoteDeleteOptions {
  noteId: string;
}

export function useNoteDelete({ noteId }: UseNoteDeleteOptions) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await client.api.notes[':id'].$delete({ param: { id: noteId } });
    },
    onSuccess: () => {
      queryClient.setQueryData<Note[]>(noteKeys.all, (current) =>
        current?.filter((note) => note.id !== noteId),
      );
      void queryClient.invalidateQueries({ queryKey: noteKeys.feeds() });
    },
  });
}
