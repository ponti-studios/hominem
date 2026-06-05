/**
 * ComposerActionsRow
 *
 * Renders the primary and secondary submit buttons.
 * Uses useFormStatus for pending state — must be rendered inside <form>.
 * Each button carries name="intent" value="<action>" so FormData identifies
 * which button was clicked — standard HTML multi-submit-button pattern.
 *
 * canSubmit is derived from the store slice — only re-renders when content
 * availability changes, not on every keystroke.
 */

import { ArrowUp, CirclePlus, MessageSquare, Mic, Sparkles } from 'lucide-react';
import { memo } from 'react';
import { useFormStatus } from 'react-dom';

import { cn } from '../../lib/utils';
import type { ComposerPresentation } from './composer-presentation';
import { useComposerSlice, useComposerStore } from './composer-provider';

function primaryIntent(posture: ComposerPresentation['posture']): string {
  switch (posture) {
    case 'reply':
      return 'send-reply';
    case 'draft':
      return 'update-note';
    case 'note-query':
      return 'start-chat';
    default:
      return 'save-note';
  }
}

function secondaryIntent(posture: ComposerPresentation['posture']): string {
  switch (posture) {
    case 'reply':
      return 'save-as-note';
    default:
      return 'start-chat';
  }
}

function ActionButton({
  intent,
  icon,
  label,
  disabled,
  variant,
  onClick,
}: {
  intent?: string;
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
  variant: 'primary' | 'secondary';
  onClick?: () => void;
}) {
  const isPrimary = variant === 'primary';
  const buttonProps = onClick
    ? { type: 'button' as const, onClick }
    : { type: 'submit' as const, name: 'intent', value: intent };
  return (
    <button
      {...buttonProps}
      aria-label={label}
      title={label}
      disabled={disabled}
      data-testid={isPrimary ? 'composer-primary' : 'composer-secondary'}
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        isPrimary ? 'bg-foreground text-background' : 'border border-border-subtle bg-background text-text-secondary',
        isPrimary &&
          (disabled
            ? 'cursor-not-allowed bg-surface text-text-tertiary'
            : 'border-transparent bg-foreground text-background hover:bg-foreground/90'),
        !isPrimary && 'hover:border-border-default hover:bg-surface hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {icon}
    </button>
  );
}

export const ComposerActionsRow = memo(function ComposerActionsRow({
  presentation,
  isPending,
  voiceDialogRef,
  showsVoiceButton,
}: {
  presentation: ComposerPresentation;
  isPending: boolean;
  voiceDialogRef: React.RefObject<HTMLDialogElement | null>;
  showsVoiceButton: boolean;
}) {
  const hasContent = useComposerSlice(
    (s) => s.draft.trim().length > 0 || s.uploadedFiles.length > 0,
  );
  const isUploading = useComposerSlice((s) => s.isUploading);
  const isEnhancing = useComposerSlice((s) => s.isEnhancing);
  const store = useComposerStore();

  const { pending: formPending } = useFormStatus();

  const disabled = !hasContent || isPending || formPending || isUploading || isEnhancing;

  const showVoiceAsPrimary = showsVoiceButton && !hasContent;

  return (
    <div className="flex items-center gap-1.5">
      <ActionButton
        icon={<Sparkles className="size-4.5" />}
        label="Enhance text"
        disabled={!hasContent || isPending || formPending || isUploading || isEnhancing}
        variant="secondary"
        onClick={() => store.dispatch({ type: 'SET_ENHANCE_OPEN', isOpen: true })}
      />
      {presentation.posture !== 'note-query' && !showVoiceAsPrimary && (
        <ActionButton
          intent={secondaryIntent(presentation.posture)}
          icon={
            presentation.secondaryActionIcon === 'plus.circle' ? (
              <CirclePlus className="size-4.5" />
            ) : (
              <MessageSquare className="size-4.5" />
            )
          }
          label={presentation.secondaryActionLabel}
          disabled={disabled}
          variant="secondary"
        />
      )}
      {showVoiceAsPrimary ? (
        <ActionButton
          icon={<Mic className="size-4.5" />}
          label="Voice note"
          disabled={isPending || formPending || isEnhancing}
          variant="primary"
          onClick={() => voiceDialogRef.current?.showModal()}
        />
      ) : (
        <ActionButton
          intent={primaryIntent(presentation.posture)}
          icon={
            presentation.primaryActionIcon === 'plus.circle' ? (
              <CirclePlus className="size-4.5" />
            ) : (
              <ArrowUp className="size-4.5" />
            )
          }
          label={presentation.primaryActionLabel}
          disabled={disabled}
          variant="primary"
        />
      )}
    </div>
  );
});
