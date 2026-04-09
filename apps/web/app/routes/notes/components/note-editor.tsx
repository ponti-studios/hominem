import type { Note } from '@hominem/rpc/types/notes.types';
import { SurfacePanel } from '@hominem/ui';
import { SpeechInput } from '@hominem/ui/ai-elements';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@hominem/ui/alert-dialog';
import { Button } from '@hominem/ui/button';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useDeleteNote, useUpdateNote } from '~/hooks/use-notes';
import { useTranscribe } from '~/hooks/use-transcribe';
import { useFileUpload } from '~/lib/hooks/use-file-upload';

interface NoteEditorProps {
  note: Note;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved';

function slugifyTitle(title: string | null) {
  return (title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function NoteEditor({ note }: NoteEditorProps) {
  const navigate = useNavigate();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const transcribe = useTranscribe();
  const { uploadFiles, uploadState } = useFileUpload();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <NoteEditorState
      key={note.id}
      note={note}
      navigate={navigate}
      updateNote={updateNote}
      deleteNote={deleteNote}
      transcribe={transcribe}
      uploadFiles={uploadFiles}
      uploadState={uploadState}
      fileInputRef={fileInputRef}
      debounceRef={debounceRef}
    />
  );
}

interface NoteEditorStateProps {
  note: Note;
  navigate: ReturnType<typeof useNavigate>;
  updateNote: ReturnType<typeof useUpdateNote>;
  deleteNote: ReturnType<typeof useDeleteNote>;
  transcribe: ReturnType<typeof useTranscribe>;
  uploadFiles: ReturnType<typeof useFileUpload>['uploadFiles'];
  uploadState: ReturnType<typeof useFileUpload>['uploadState'];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  debounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

function NoteEditorState({
  note,
  navigate,
  updateNote,
  deleteNote,
  transcribe,
  uploadFiles,
  uploadState,
  fileInputRef,
  debounceRef,
}: NoteEditorStateProps) {
  const [title, setTitle] = useState(note.title || '');
  const [content, setContent] = useState(note.content);
  const [files, setFiles] = useState(note.files);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const attachedFileIds = useMemo(() => files.map((file) => file.id), [files]);

  function scheduleSave(nextTitle: string, nextContent: string, fileIds = attachedFileIds) {
    setSaveStatus('unsaved');
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await updateNote.mutateAsync({
          id: note.id,
          title: nextTitle || null,
          content: nextContent,
          fileIds,
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('unsaved');
      }
    }, 500);
  }

  async function handleAttachFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const uploadedFiles = await uploadFiles(fileList);
    if (uploadedFiles.length === 0) {
      return;
    }

    const nextFiles = [
      ...files,
      ...uploadedFiles.map((file) => ({
        ...file,
        uploadedAt: file.uploadedAt.toISOString(),
      })),
    ];
    setFiles(nextFiles);
    await updateNote.mutateAsync({
      id: note.id,
      title: title || null,
      content,
      fileIds: nextFiles.map((file) => file.id),
    });
  }

  async function detachFile(fileId: string) {
    const nextFiles = files.filter((file) => file.id !== fileId);
    setFiles(nextFiles);
    await updateNote.mutateAsync({
      id: note.id,
      title: title || null,
      content,
      fileIds: nextFiles.map((file) => file.id),
    });
  }

  async function handleDelete() {
    try {
      await deleteNote.mutateAsync({ id: note.id });
      navigate('/notes');
    } catch {}
  }

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextTitle = event.target.value;
    setTitle(nextTitle);
    scheduleSave(nextTitle, content);
  };

  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextContent = event.target.value;
    setContent(nextContent);
    scheduleSave(title, nextContent);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <SurfacePanel>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
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
          onChange={handleContentChange}
          placeholder="Start writing..."
          aria-label="Note content"
          className="mt-6 min-h-[50vh] w-full resize-none border-0 bg-transparent text-base leading-7 outline-none placeholder:text-text-tertiary"
        />
      </SurfacePanel>

      <aside className="space-y-4">
        <SurfacePanel
          data-upload-state={uploadState.state}
          data-upload-progress={uploadState.progress}
        >
          <h2 className="text-sm font-semibold text-foreground">Actions</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              Attach files
            </Button>
            <Link
              to={`/chat?noteId=${note.id}`}
              className="inline-flex items-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Chat with this note
            </Link>
          </div>
          <div className="mt-3">
            <SpeechInput
              ariaLabel="Dictate note"
              onAudioRecorded={async (audioBlob: Blob) => {
                const result = await transcribe.mutateAsync({ audioBlob });
                const nextContent = `${content}\n${result.text}`.trim();
                setContent(nextContent);
                scheduleSave(title, nextContent);
              }}
            />
          </div>
          <input
            ref={fileInputRef}
            hidden
            multiple
            type="file"
            data-testid="note-file-input"
            onChange={(event) => {
              void handleAttachFiles(event.target.files);
              event.currentTarget.value = '';
            }}
          />
          {uploadState.errors.length > 0 ? (
            <p className="mt-3 text-sm text-destructive">{uploadState.errors.join(', ')}</p>
          ) : null}
        </SurfacePanel>

        <SurfacePanel>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Files</h2>
            <span className="text-xs text-text-tertiary">{files.length}</span>
          </div>
          <div className="mt-3 space-y-2">
            {files.length === 0 ? (
              <p className="text-sm text-text-secondary">No files attached yet.</p>
            ) : null}
            {files.map((file) => (
              <div key={file.id} className="rounded-xl border border-border-subtle p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      className="font-medium text-foreground underline"
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {file.originalName}
                    </a>
                    <p className="mt-1 text-xs text-text-tertiary">{file.mimetype}</p>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-text-secondary"
                    onClick={() => void detachFile(file.id)}
                  >
                    Detach
                  </button>
                </div>
                {file.textContent || file.content ? (
                  <p className="mt-2 line-clamp-4 text-sm text-text-secondary">
                    {file.textContent ?? file.content}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel>
          <h2 className="text-sm font-semibold text-foreground">Delete</h2>
          <p className="mt-2 text-sm text-text-secondary">
            File deletion is available from the files API. This screen currently supports attach and
            detach for notes.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                disabled={deleteNote.isPending}
              >
                {deleteNote.isPending ? 'Deleting…' : 'Delete note'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the note from your feed and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteNote.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void handleDelete()}
                  disabled={deleteNote.isPending}
                >
                  {deleteNote.isPending ? 'Deleting…' : 'Confirm delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {deleteNote.isError ? (
            <p className="mt-3 text-sm text-destructive">
              Failed to delete note. Please try again.
            </p>
          ) : null}
        </SurfacePanel>
      </aside>
    </div>
  );
}
