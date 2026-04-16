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
  onSave: (titleValue: string, contentValue: string, fileIds: string[]) => Promise<void>;
}

interface SaveHandler {
  (input: { id: string; title: string | null; content: string; fileIds: string[] }): Promise<void>;
}

export function useNoteEditor(note: UseNoteEditorInput, onSave: SaveHandler): UseNoteEditorOutput {
  const [title, setTitle] = useState(note.title || '');
  const [content, setContent] = useState(note.content);
  const [files, setFiles] = useState(note.files);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSave = useCallback(
    (titleValue: string, contentValue: string, fileIds: string[]): Promise<void> => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      return new Promise((resolve, reject) => {
        debounceRef.current = setTimeout(() => {
          onSave({
            id: note.id,
            title: titleValue || null,
            content: contentValue,
            fileIds,
          })
            .then(() => {
              resolve();
            })
            .catch((error: unknown) => {
              reject(error);
            });
        }, 600);
      });
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
    onSave: handleSave,
  };
}
