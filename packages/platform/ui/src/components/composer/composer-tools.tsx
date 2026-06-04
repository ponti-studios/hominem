/**
 * ComposerTools
 *
 * Toolbar buttons. Receives stable refs directly and calls browser APIs
 * (showModal, click) inline — no callback props, no useCallback.
 * Subscribes to attachedNotesCount from the store — only re-renders when
 * the count changes, not on every draft keystroke.
 */

import { BookOpen, Camera, Plus } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

import { isTouchDevice } from '../../lib/device';
import { cn } from '../../lib/utils';
import type { ComposerPresentation } from './composer-presentation';
import { useComposerSlice } from './composer-provider';

function ToolButton({
  icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active || undefined}
      className={cn(
        'flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-background px-2.5 text-text-tertiary transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        disabled && 'cursor-not-allowed opacity-40',
        active
          ? 'border-border-default bg-surface text-foreground'
          : 'hover:border-border-default hover:bg-surface hover:text-foreground',
      )}
    >
      {icon}
    </button>
  );
}

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
  const [isTouchDeviceState, setIsTouchDeviceState] = useState(() => isTouchDevice());

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px) and (any-hover: none)');
    const handleChange = () => {
      setIsTouchDeviceState(isTouchDevice());
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      {presentation.showsNotePicker && (
        <ToolButton
          icon={<BookOpen className="size-4" />}
          label="Attach notes as context"
          onClick={() => notePickerDialogRef.current?.showModal()}
          active={attachedNotesCount > 0}
          disabled={false}
        />
      )}
      {presentation.showsAttachmentButton && (
        <ToolButton
          icon={<Plus className="size-4" />}
          label="Add attachment"
          onClick={() => fileInputRef.current?.click()}
          active={false}
          disabled={false}
        />
      )}
      {isTouchDeviceState && presentation.showsAttachmentButton && (
        <ToolButton
          icon={<Camera className="size-4" />}
          label="Take photo"
          onClick={() => cameraInputRef.current?.click()}
          active={false}
          disabled={false}
        />
      )}
    </div>
  );
});
