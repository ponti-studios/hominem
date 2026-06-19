import { useApiClient } from '@hominem/rpc/react';
import type { Note } from '@hominem/rpc/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
import { clearCachedNote } from '~/services/workspace/content-cache';
import {
  clearWorkspaceResumeArtifact,
  readWorkspaceResumeArtifact,
} from '~/services/workspace/launch-state';

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
      if (readWorkspaceResumeArtifact()?.id === noteId) {
        clearWorkspaceResumeArtifact();
      }
      clearCachedNote(noteId);
      queryClient.setQueryData<Note[]>(noteKeys.all, (current) =>
        current?.filter((note) => note.id !== noteId),
      );
      void invalidateInboxQueries(queryClient);
    },
  });
}
