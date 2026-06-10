import { StatePanel } from '@hominem/ui';
import { data, redirect, useNavigate } from 'react-router';

import { NoteEditor } from '~/components/notes';
import { useTextEnhance } from '~/hooks/ai';
import { useDeleteNote, useUpdateNote } from '~/hooks/use-notes';
import { useTranscribe } from '~/hooks/use-transcribe';
import { createServerApiClient } from '~/lib/api.server';
import { useFileUpload } from '~/lib/hooks/use-file-upload';

import type { Route } from './+types/note.$noteId';

export async function loader({ request, params }: Route.LoaderArgs) {
  const { noteId } = params;

  if (!noteId) {
    return redirect('/inbox');
  }

  try {
    const client = createServerApiClient(request);
    const note = await client.api.notes[':id']
      .$get({ param: { id: noteId } })
      .then((res) => res.json());
    return data({ noteId, note });
  } catch {
    return data({ noteId, note: null });
  }
}

export default function NoteSplitView({ loaderData }: Route.ComponentProps) {
  const { note } = loaderData;
  const navigate = useNavigate();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const { enhance } = useTextEnhance();
  const transcribe = useTranscribe();
  const { uploadFiles, uploadState } = useFileUpload();

  if (!note) {
    return (
      <div className="min-h-full">
        <StatePanel title="Note not found" />
      </div>
    );
  }

  return (
    <div className="py-8">
      <NoteEditor
        note={note}
        onSave={async ({ id, title, content, fileIds }) => {
          await updateNote.mutateAsync({ id, title, content, fileIds });
        }}
        onUploadFiles={async (files) => {
          return uploadFiles(files);
        }}
        onTranscribeAudio={async (audioBlob) => {
          const result = await transcribe.mutateAsync({ audioBlob });
          return result.text;
        }}
        onEnhanceText={({ text, instruction }) => enhance({ text, instruction })}
        onDelete={async () => {
          await deleteNote.mutateAsync({ id: note.id });
          navigate('/inbox');
        }}
        isDeleting={deleteNote.isPending}
        isDeletingError={deleteNote.isError}
        uploadErrors={uploadState.errors}
        isUploading={uploadState.state === 'uploading'}
      />
    </div>
  );
}
