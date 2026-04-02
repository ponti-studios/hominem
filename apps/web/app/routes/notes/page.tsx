import { Button } from '@hominem/ui/button';
import { Link } from 'react-router';

import { useNotesList } from '~/hooks/use-notes';

export default function NotesPage() {
  const { data: notes = [], isLoading } = useNotesList({
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Notes</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Capture text, attach files, and move straight into chat.
          </p>
        </div>
        <Link to="/notes/new">
          <Button>Create note</Button>
        </Link>
      </div>

      {isLoading ? <p className="text-sm text-text-secondary">Loading notes...</p> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {notes.map((note) => (
          <Link
            key={note.id}
            to={`/notes/${note.id}`}
            className="rounded-2xl border border-border-subtle bg-surface p-4 transition hover:border-foreground/30"
          >
            <h3 className="line-clamp-2 text-base font-semibold text-foreground">
              {note.title || 'Untitled note'}
            </h3>
            <p className="mt-2 line-clamp-4 text-sm text-text-secondary">
              {note.excerpt || note.content || 'No content yet.'}
            </p>
            <div className="mt-4 flex items-center justify-between text-xs text-text-tertiary">
              <span>{note.files.length} files</span>
              <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
            </div>
          </Link>
        ))}
      </div>

      {!isLoading && notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-subtle bg-surface p-10 text-center">
          <p className="text-base text-foreground">No notes yet.</p>
          <p className="mt-2 text-sm text-text-secondary">
            Create one, add files, or dictate your first thought.
          </p>
        </div>
      ) : null}
    </div>
  );
}
