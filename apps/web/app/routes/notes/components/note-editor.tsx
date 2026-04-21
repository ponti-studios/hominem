import type { Note } from '@hakumi/rpc/types/notes.types';
import { SurfacePanel } from '@hakumi/ui';
import { useCallback } from 'react';

import { useUpdateNote } from '~/hooks/use-notes';
import type { UploadedFile } from '~/lib/types/upload';

import { DeleteNoteAlert } from './delete-note-alert';
import { NoteActionsPanel } from './note-actions-panel';
import { NoteFilesPanel } from './note-files-panel';
import { useNoteEditor } from './use-note-editor';

interface NoteEditorProps {
  note: Note;
}

function slugifyTitle(title: string | null) {
  return (title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function NoteEditor({ note }: NoteEditorProps) {
  const updateNote = useUpdateNote();
  const {
    title,
    setTitle,
    content,
    setContent,
    files,
    setFiles,
    draftRef,
    saveStatus,
    flushSave,
    scheduleIdleSave,
  } = useNoteEditor(
    {
      id: note.id,
      title: note.title,
      content: note.content,
      files: note.files.map((f) => ({
        id: f.id,
        originalName: f.originalName,
        mimetype: f.mimetype,
        size: f.size,
        url: f.url,
        uploadedAt: f.uploadedAt,
      })),
    },
    async ({ id, title: nextTitle, content: nextContent, fileIds }) => {
      await updateNote.mutateAsync({
        id,
        title: nextTitle,
        content: nextContent,
        fileIds,
      });
    },
  );

  const handleFilesUploaded = useCallback(
    async (uploadedFiles: UploadedFile[]) => {
      const nextFiles = [
        ...draftRef.current.files,
        ...uploadedFiles.map((file) => ({
          ...file,
          uploadedAt: file.uploadedAt.toISOString(),
        })),
      ];
      setFiles(nextFiles);
      await flushSave();
    },
    [draftRef, flushSave, setFiles],
  );

  const handleTranscribed = useCallback(
    async (text: string) => {
      const nextContent = `${draftRef.current.content}\n${text}`.trim();
      setContent(nextContent);
      await flushSave();
    },
    [draftRef, flushSave, setContent],
  );

  const handleDetachFile = useCallback(
    async (fileId: string) => {
      const nextFiles = draftRef.current.files.filter((file) => file.id !== fileId);
      setFiles(nextFiles);
      await flushSave();
    },
    [draftRef, flushSave, setFiles],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <SurfacePanel>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                scheduleIdleSave();
              }}
              onBlur={() => void flushSave().catch(() => undefined)}
              placeholder="Untitled note"
              aria-label="Note title"
              className="w-full border-0 bg-transparent text-3xl font-semibold outline-none placeholder:text-text-tertiary"
            />
            <p className="mt-2 text-sm text-text-secondary">
              Mention this note in chat as <code>#{slugifyTitle(title || note.title)}</code>.
            </p>
          </div>
          <span className="rounded-full border border-border-subtle px-3 py-1 text-xs uppercase tracking-[0.2em] text-text-secondary">
            {saveStatus}
          </span>
        </div>

        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            scheduleIdleSave();
          }}
          onBlur={() => void flushSave().catch(() => undefined)}
          placeholder="Start writing..."
          aria-label="Note content"
          className="mt-6 min-h-[50vh] w-full resize-none border-0 bg-transparent text-base leading-7 outline-none placeholder:text-text-tertiary"
        />
      </SurfacePanel>

      <aside className="space-y-4">
        <NoteActionsPanel
          noteId={note.id}
          onFilesUploaded={handleFilesUploaded}
          onTranscribed={handleTranscribed}
        />

        <NoteFilesPanel files={files} onDetachFile={handleDetachFile} />

        <DeleteNoteAlert noteId={note.id} />
      </aside>
    </div>
  );
}
