import { useApiClient } from '@hominem/rpc/react';
import type { Note } from '@hominem/rpc/types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { noteKeys } from '~/services/notes/query-keys';
import { writeCachedNote } from '~/services/workspace/content-cache';

import { createDebouncedNoteSaver, type NoteSavePayload } from './debounced-note-saver';

const NOTE_SAVE_DEBOUNCE_MS = 600;

export function useNoteEditor(noteId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { requestTopReveal } = useTopAnchoredFeed();

  const commitServerResponse = useCallback(
    (updatedNote: Note) => {
      writeCachedNote(updatedNote);
      queryClient.setQueryData<Note>(noteKeys.detail(updatedNote.id), updatedNote);
      queryClient.setQueryData<Note[]>(noteKeys.all, (current) => {
        if (!current) return [updatedNote];
        return current.map((entry) => (entry.id === updatedNote.id ? updatedNote : entry));
      });
      requestTopReveal();
      void invalidateInboxQueries(queryClient);
    },
    [queryClient, requestTopReveal],
  );

  const persistSave = useCallback(
    async ({ content, fileIds, title }: NoteSavePayload) => {
      const res = await client.api.notes[':id'].$patch({
        param: { id: noteId },
        json: { title: title || null, content, fileIds },
      });
      return res.json();
    },
    [noteId, client],
  );

  const saver = useMemo(
    () =>
      createDebouncedNoteSaver({
        commit: commitServerResponse,
        delayMs: NOTE_SAVE_DEBOUNCE_MS,
        persist: persistSave,
      }),
    [commitServerResponse, persistSave],
  );

  useEffect(() => () => saver.flush(), [saver]);

  const save = useCallback(
    (title: string | null, content: string, fileIds: string[]) => {
      saver.schedule({ title: title || null, content, fileIds });
    },
    [saver],
  );

  const updateCache = useCallback(
    (patch: Partial<Note>) => {
      queryClient.setQueryData<Note>(noteKeys.detail(noteId), (prev) =>
        prev
          ? (() => {
              const nextNote = { ...prev, ...patch };
              writeCachedNote(nextNote);
              return nextNote;
            })()
          : prev,
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
