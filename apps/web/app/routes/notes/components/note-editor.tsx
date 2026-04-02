import { useApiClient } from '@hominem/rpc/react';
import type { Note } from '@hominem/rpc/types/notes.types';
import { SpeechInput } from '@hominem/ui/ai-elements/speech-input';
import { Button } from '@hominem/ui/button';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useUpdateNote } from '~/hooks/use-notes';
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
  const apiClient = useApiClient();
  const updateNote = useUpdateNote();
  const transcribe = useTranscribe();
  const { uploadFiles, uploadState, clearAll } = useFileUpload();

  const [title, setTitle] = useState(note.title || '');
  const [content, setContent] = useState(note.content);
  const [files, setFiles] = useState(note.files);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitle(note.title || '');
    setContent(note.content);
    setFiles(note.files);
    setSaveStatus('saved');
  }, [note.content, note.files, note.id, note.title]);

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );

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

    const nextFiles = [...files, ...uploadedFiles];
    setFiles(nextFiles);
    await updateNote.mutateAsync({
      id: note.id,
      title: title || null,
      content,
      fileIds: nextFiles.map((file) => file.id),
    });
    clearAll();
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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-2xl border border-border-subtle bg-surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={title}
              onChange={(event) => {
                const nextTitle = event.target.value;
                setTitle(nextTitle);
                scheduleSave(nextTitle, content);
              }}
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
          onChange={(event) => {
            const nextContent = event.target.value;
            setContent(nextContent);
            scheduleSave(title, nextContent);
          }}
          placeholder="Start writing..."
          aria-label="Note content"
          className="mt-6 min-h-[50vh] w-full resize-none border-0 bg-transparent text-base leading-7 outline-none placeholder:text-text-tertiary"
        />
      </div>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-border-subtle bg-surface p-4">
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
              onAudioRecorded={async (audioBlob) => {
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
            onChange={(event) => {
              void handleAttachFiles(event.target.files);
              event.currentTarget.value = '';
            }}
          />
          {uploadState.errors.length > 0 ? (
            <p className="mt-3 text-sm text-destructive">{uploadState.errors.join(', ')}</p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border-subtle bg-surface p-4">
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
        </section>

        <section className="rounded-2xl border border-border-subtle bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground">Delete</h2>
          <p className="mt-2 text-sm text-text-secondary">
            File deletion is available from the files API. This screen currently supports attach and
            detach for notes.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={async () => {
              await apiClient.notes.delete({ id: note.id });
              window.location.href = '/notes';
            }}
          >
            Delete note
          </Button>
        </section>
      </aside>
    </div>
  );
}
