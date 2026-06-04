/**
 * AttachedNotesList
 *
 * Subscribes directly to the store's attachedNotes slice.
 * Only re-renders when the attached notes change — not on draft keystrokes.
 * Dispatches DETACH_NOTE directly without callback props.
 */

import { FileText, X } from 'lucide-react';
import { memo } from 'react';

import { useComposerSlice, useComposerStore } from './composer-provider';

export const AttachedNotesList = memo(function AttachedNotesList() {
  const store = useComposerStore();
  const attachedNotes = useComposerSlice((s) => s.attachedNotes);

  if (attachedNotes.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {attachedNotes.map((note) => (
        <button
          key={note.id}
          type="button"
          onClick={() => store.dispatch({ type: 'DETACH_NOTE', noteId: note.id })}
          aria-label={`Remove ${note.title ?? 'note'}`}
          className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-border-subtle bg-background px-2.5 py-2 text-left transition-colors duration-150 hover:border-border-default hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <FileText className="size-3 shrink-0 text-text-tertiary" />
          <span className="body-4 min-w-0 max-w-32 truncate font-medium text-foreground">
            {note.title || 'Untitled note'}
          </span>
          <X className="size-3 shrink-0 text-text-tertiary" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
});
