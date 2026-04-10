import { StatePanel } from '@hominem/ui';

import { useNote } from '~/hooks/use-notes';

import { LoadingScreen } from '../../components/loading';
import { NoteEditor } from './components/note-editor';
import { noteIdLoader } from './note-id.loader';

export { noteIdLoader as loader };

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
