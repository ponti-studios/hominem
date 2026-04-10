import { useCallback, useRef, useState } from 'react';

export interface NoteFile {
  id: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedAt: string;
}

export interface UseNoteEditorInput {
  id: string;
  title: string | null;
  content: string;
  files: NoteFile[];
}

export interface UseNoteEditorOutput {
  title: string;
  setTitle: (title: string) => void;
  content: string;
  setContent: (content: string) => void;
  files: NoteFile[];
  setFiles: (files: NoteFile[]) => void;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  isSaving: boolean;
  onSave: (
    titleValue: string,
    contentValue: string,
    fileIds: string[],
  ) => Promise<void>;
  attachedFileIds: string[];
}

interface SaveHandler {
  (input: {
    id: string;
    title: string | null;
    content: string;
    fileIds: string[];
  }): Promise<void>;
}

/**
 * Shared hook for note editing state and debounced save logic.
 * Used by both web (React Router) and mobile (Expo Router) apps.
 *
 * @param note The initial note data
 * @param onSave Callback to handle save operation (should call API to update note)
 * @returns State and callbacks for note editing
 */
export function useNoteEditor(
  note: UseNoteEditorInput,
  onSave: SaveHandler,
): UseNoteEditorOutput {
  const [title, setTitle] = useState(note.title || '');
  const [content, setContent] = useState(note.content);
  const [files, setFiles] = useState(note.files);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const attachedFileIds = files.map((file) => file.id);

  const handleSave = useCallback(
    async (titleValue: string, contentValue: string, fileIds: string[]): Promise<void> => {
      // Clear any pending debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      setSaveStatus('saving');
      try {
        await onSave({
          id: note.id,
          title: titleValue || null,
          content: contentValue,
          fileIds,
        });
        setSaveStatus('saved');
      } catch (error) {
        setSaveStatus('unsaved');
        throw error;
      }
    },
    [note.id, onSave],
  );

  return {
    title,
    setTitle,
    content,
    setContent,
    files,
    setFiles,
    saveStatus,
    isSaving: saveStatus === 'saving',
    onSave: handleSave,
    attachedFileIds,
  };
}
