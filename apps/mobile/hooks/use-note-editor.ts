import { useApiClient } from '@hominem/rpc/react';
import type { Note } from '@hominem/rpc/types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { noteKeys } from '~/services/notes/query-keys';

export function useNoteEditor(noteId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { requestTopReveal } = useTopAnchoredFeed();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitServerResponse = useCallback(
    (updatedNote: Note) => {
      queryClient.setQueryData<Note>(noteKeys.detail(updatedNote.id), updatedNote);
      queryClient.setQueryData<Note[]>(noteKeys.all, (current) => {
        if (!current) return [updatedNote];
        return current.map((entry) => (entry.id === updatedNote.id ? updatedNote : entry));
      });
      requestTopReveal();
      void queryClient.invalidateQueries({ queryKey: noteKeys.feeds() });
      void invalidateInboxQueries(queryClient);
    },
    [queryClient, requestTopReveal],
  );

  const save = useCallback(
    (title: string | null, content: string, fileIds: string[]): Promise<void> => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return new Promise((resolve, reject) => {
        debounceRef.current = setTimeout(() => {
          client.api.notes[':id']
            .$patch({ param: { id: noteId }, json: { title: title || null, content, fileIds } })
            .then((res) => res.json())
            .then((updatedNote) => {
              commitServerResponse(updatedNote);
              resolve();
            })
            .catch((error: unknown) => reject(error));
        }, 600);
      });
    },
    [noteId, client, commitServerResponse],
  );

  const updateCache = useCallback(
    (patch: Partial<Note>) => {
      queryClient.setQueryData<Note>(noteKeys.detail(noteId), (prev) =>
        prev ? { ...prev, ...patch } : prev,
      );
    },
    [queryClient, noteId],
  );

  const detachFile = useCallback(
    async (fileId: string, currentFiles: Note['files'], title: string | null, content: string) => {
      const nextFiles = currentFiles.filter((f) => f.id !== fileId);
      updateCache({ files: nextFiles });
      const res = await client.api.notes[':id'].$patch({
        param: { id: noteId },
        json: { title: title || null, content, fileIds: nextFiles.map((f) => f.id) },
      });
      commitServerResponse(await res.json());
    },
    [noteId, client, updateCache, commitServerResponse],
  );

  return { save, updateCache, detachFile };
}
