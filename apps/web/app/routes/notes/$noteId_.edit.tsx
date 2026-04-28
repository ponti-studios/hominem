import type { Note } from '@hominem/rpc/types/notes.types';
import { StatePanel } from '@hominem/ui';
import { NoteEditor } from '@hominem/ui/notes';
import { useNavigate } from 'react-router';

import { useDeleteNote, useUpdateNote } from '~/hooks/use-notes';
import { useTranscribe } from '~/hooks/use-transcribe';
import { useFileUpload } from '~/lib/hooks/use-file-upload';

import { noteIdLoader } from './note-id.loader';

export { noteIdLoader as loader };

export default function NoteEditPage({
  loaderData,
}: {
  loaderData: { noteId: string; note: Note | null };
}) {
  const { note } = loaderData;
  const navigate = useNavigate();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const transcribe = useTranscribe();
  const { uploadFiles, uploadState } = useFileUpload();

  if (!note) {
    return <StatePanel title="Note not found" className="min-h-full" />;
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
        onDelete={async () => {
          await deleteNote.mutateAsync({ id: note.id });
          navigate('/notes');
        }}
        isDeleting={deleteNote.isPending}
        isDeletingError={deleteNote.isError}
        uploadErrors={uploadState.errors}
        isUploading={uploadState.state === 'uploading'}
      />
    </div>
  );
}
