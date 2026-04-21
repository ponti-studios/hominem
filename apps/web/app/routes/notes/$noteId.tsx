import { StatePanel } from '@hakumi/ui';

import { useNote } from '~/hooks/use-notes';

import { LoadingScreen } from '../../components/loading';
import { NoteEditor } from './components/note-editor';
import { noteIdLoader } from './note-id.loader';

export { noteIdLoader as loader };

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
