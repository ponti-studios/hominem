/**
 * ComposerTools
 *
 * Toolbar buttons. Receives stable refs directly and calls browser APIs
 * (showModal, click) inline — no callback props, no useCallback.
 * Subscribes to attachedNotesCount from the store — only re-renders when
 * the count changes, not on every draft keystroke.
 */

import { BookOpen, Camera, Plus } from 'lucide-react';
import { memo } from 'react';

import { cn } from '../../lib/utils';
import { Button } from '../button';
import type { ComposerPresentation } from './composer-presentation';
import { useComposerSlice } from './composer-provider';

export const ComposerTools = memo(function ComposerTools({
  fileInputRef,
  cameraInputRef,
  notePickerDialogRef,
  presentation,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  notePickerDialogRef: React.RefObject<HTMLDialogElement | null>;
  presentation: ComposerPresentation;
}) {
  const attachedNotesCount = useComposerSlice((s) => s.attachedNotes.length);

  return (
    <div className="flex items-center gap-1.5">
      {presentation.showsNotePicker && (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Attach notes as context"
          title="Attach notes as context"
          onClick={() => notePickerDialogRef.current?.showModal()}
          disabled={false}
          aria-pressed={attachedNotesCount > 0 || undefined}
          className={cn(
            attachedNotesCount > 0
              ? 'border-border-default bg-surface text-foreground'
              : '[--void-hover-bg:var(--color-bg-surface)] [--void-hover-border:var(--color-border-default)] [--void-hover-color:var(--color-foreground)]',
          )}
        >
          <BookOpen className="size-4" />
        </Button>
      )}
      {presentation.showsAttachmentButton && (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Add attachment"
          title="Add attachment"
          onClick={() => fileInputRef.current?.click()}
          disabled={false}
        >
          <Plus className="size-4" />
        </Button>
      )}
      {presentation.showsAttachmentButton && (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Take photo"
          title="Take photo"
          onClick={() => cameraInputRef.current?.click()}
          disabled={false}
        >
          <Camera className="size-4" />
        </Button>
      )}
    </div>
  );
});
