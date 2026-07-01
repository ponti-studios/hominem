import { useApiClient } from '@hominem/rpc/react';
import type { Note } from '@hominem/rpc/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { hasDefinedData, resolveRestoredQueryState } from '~/services/query/restored-query-state';
import { readCachedNote, writeCachedNote } from '~/services/content-cache';

import { noteKeys } from './query-keys';

export const useNoteQuery = ({ noteId, enabled = true }: { noteId: string; enabled?: boolean }) => {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const cachedNote = readCachedNote(noteId);

  const noteQuery = useQuery<Note>({
    queryKey: noteKeys.detail(noteId),
    queryFn: async () => {
      const res = await client.api.notes[':id'].$get({ param: { id: noteId } });
      const note = await res.json();
      writeCachedNote(note);

      queryClient.setQueryData<Note[]>(noteKeys.all, (current) => {
        if (!current) {
          return [note];
        }

        const hasNote = current.some((item) => item.id === note.id);
        if (hasNote) {
          return current.map((item) => (item.id === note.id ? note : item));
        }

        return [note, ...current];
      });

      return note;
    },
    initialData: () => {
      if (cachedNote) {
        return cachedNote;
      }

      const cachedNotes = queryClient.getQueryData<Note[]>(noteKeys.all);
      return cachedNotes?.find((item) => item.id === noteId);
    },
    initialDataUpdatedAt: cachedNote ? 0 : undefined,
    enabled: enabled && noteId.length > 0,
  });

  const restoredState = resolveRestoredQueryState({
    data: noteQuery.data,
    isPending: noteQuery.isPending,
    isFetching: noteQuery.isFetching,
    hasUsableData: hasDefinedData,
  });

  return {
    ...noteQuery,
    hasUsableData: restoredState.hasUsableData,
    isInitialLoading: restoredState.isInitialLoading,
    isRefreshing: restoredState.isRefreshing,
  };
};
