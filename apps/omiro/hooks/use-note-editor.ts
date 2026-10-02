import { useApiClient } from '@hominem/rpc/react';
import type { Note } from '@hominem/rpc/types';
import { logger } from '@hominem/telemetry';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { useLatch } from '~/hooks/use-latch';
import { patchInboxEntity } from '~/services/inbox/inbox-entities';
import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
import { noteKeys } from '~/services/notes/query-keys';
import t from '~/translations';

import { createDebouncedNoteSaver, type NoteSavePayload } from './debounced-note-saver';

const NOTE_SAVE_DEBOUNCE_MS = 600;

export type NoteSaveStatus = 'saving' | 'saved' | 'error';

export function useNoteEditor(noteId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const saveErrorShown = useLatch();
  const [saveStatus, setSaveStatus] = useState<NoteSaveStatus>('saved');

  const commitServerResponse = useCallback(
    (updatedNote: Note) => {
      saveErrorShown.release();
      setSaveStatus('saved');
      queryClient.setQueryData<Note>(noteKeys.detail(updatedNote.id), updatedNote);
      patchInboxEntity(
        queryClient,
        { kind: 'note', entityId: updatedNote.id },
        {
          preview: updatedNote.excerpt,
          title: updatedNote.title,
          updatedAt: updatedNote.updatedAt,
        },
      );
      void invalidateInboxQueries(queryClient);
    },
    [queryClient, saveErrorShown],
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

  const handleSaveError = useCallback(
    (error: unknown) => {
      logger.error(
        '[note-editor] save failed',
        error instanceof Error ? error : new Error(String(error)),
      );
      setSaveStatus('error');
      void queryClient.invalidateQueries({ queryKey: noteKeys.detail(noteId) });
      if (saveErrorShown.isLatched()) {
        return;
      }

      saveErrorShown.latch();
      Alert.alert(t.notes.editor.saveErrorTitle, t.notes.editor.saveErrorMessage);
    },
    [noteId, queryClient, saveErrorShown],
  );

  const saver = useMemo(
    () =>
      createDebouncedNoteSaver({
        commit: commitServerResponse,
        delayMs: NOTE_SAVE_DEBOUNCE_MS,
        onError: handleSaveError,
        persist: persistSave,
      }),
    [commitServerResponse, handleSaveError, persistSave],
  );

  useEffect(() => () => saver.flush(), [saver]);

  const save = useCallback(
    (title: string | null, content: string, fileIds: string[]) => {
      setSaveStatus('saving');
      saver.schedule({ title: title || null, content, fileIds });
    },
    [saver],
  );

  const flushSave = useCallback(
    (title: string, content: string, fileIds: string[]) => {
      setSaveStatus('saving');
      return saver.persistNow({ title: title || null, content, fileIds });
    },
    [saver],
  );

  const updateCache = useCallback(
    (patch: Partial<Note>) => {
      queryClient.setQueryData<Note>(noteKeys.detail(noteId), (prev) =>
        prev
          ? (() => {
              const nextNote = { ...prev, ...patch };
              patchInboxEntity(
                queryClient,
                { kind: 'note', entityId: noteId },
                {
                  title: nextNote.title,
                },
              );
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
      await saver.persistNow({
        title: title || null,
        content,
        fileIds: nextFiles.map((f) => f.id),
      });
    },
    [saver, updateCache],
  );

  return { save, flushSave, updateCache, detachFile, saveStatus };
}
