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

export default function NoteEditPage({ loaderData }: { loaderData: { noteId: string } }) {
  const { noteId } = loaderData;
  const { data: note, isLoading } = useNote(noteId);

  if (isLoading) {
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
