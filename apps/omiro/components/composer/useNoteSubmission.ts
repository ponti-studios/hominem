import { logger } from '@hominem/telemetry';
import { useCallback } from 'react';

import { donateAddNoteIntent } from '~/services/intent-donation';
import { useCreateNote } from '~/services/notes/use-create-note';

interface NoteSubmissionInput {
  clearComposer: () => void;
  fileIds: string[];
  message: string;
  restoreMessage: (message: string) => void;
  onSaved?: () => void;
}

export function useNoteSubmission() {
  const { mutateAsync: createNote } = useCreateNote();

  // Optimistic: the note is already in the list (see useCreateNote) and the
  // composer is emptied straight away, so nothing waits on the request. If it
  // fails, the list rolls back and the text is put back for another try.
  const submitNote = useCallback(
    async ({ clearComposer, fileIds, message, onSaved, restoreMessage }: NoteSubmissionInput) => {
      const text = message.trim();
      const pending = createNote({ text, fileIds });
      clearComposer();
      onSaved?.();

      try {
        await pending;
        donateAddNoteIntent();
      } catch (error) {
        restoreMessage(message);
        logger.warn('[useNoteSubmission] createNote failed', { error });
      }
    },
    [createNote],
  );

  return { submitNote };
}
