import { StatePanel } from '@hominem/ui';
import { type LoaderFunctionArgs, redirect } from 'react-router';

import { useNote } from '~/hooks/use-notes';
import { requireAuth } from '~/lib/guards';

import { LoadingScreen } from '../../components/loading';
import { NoteEditor } from './components/note-editor';

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAuth(request);
  const { noteId } = params;

  if (!noteId) {
    return redirect('/notes');
  }

  return { noteId };
}

export default function NoteSplitView({ loaderData }: { loaderData: { noteId: string } }) {
  const { noteId } = loaderData;
  const { data: note, isLoading: isNoteLoading } = useNote(noteId);

  if (isNoteLoading) {
    return <LoadingScreen />;
  }

  if (!note) {
    return <StatePanel title="Note not found" className="min-h-full" />;
  }

  return (
    <div className="py-8">
      <NoteEditor note={note} />
    </div>
  );
}
