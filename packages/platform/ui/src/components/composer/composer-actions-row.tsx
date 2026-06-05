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

import { Button } from '../button';
import type { ComposerActionIcon, ComposerPresentation } from './composer-presentation';
import { useComposerSlice, useComposerStore } from './composer-provider';

function ActionIcon({ icon }: { icon: ComposerActionIcon }) {
  switch (icon) {
    case 'plus.circle':
      return <CirclePlus className="size-4.5" />;
    case 'bubble.left':
      return <MessageSquare className="size-4.5" />;
    default:
      return <ArrowUp className="size-4.5" />;
  }
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
      <Button
        size="icon"
        variant="outline"
        aria-label="Enhance text"
        title="Enhance text"
        disabled={!hasContent || isPending || formPending || isUploading || isEnhancing}
        onClick={() => store.dispatch({ type: 'SET_ENHANCE_OPEN', isOpen: true })}
        data-testid="composer-secondary"
      >
        <Sparkles className="size-4.5" />
      </Button>
      {presentation.secondaryAction && !showVoiceAsPrimary && (
        <Button
          size="icon"
          variant="outline"
          type="submit"
          name="intent"
          value={presentation.secondaryAction.intent}
          aria-label={presentation.secondaryAction.label}
          title={presentation.secondaryAction.label}
          disabled={disabled}
          data-testid="composer-secondary"
        >
          <ActionIcon icon={presentation.secondaryAction.icon} />
        </Button>
      )}
      {showVoiceAsPrimary ? (
        <Button
          size="icon"
          aria-label="Voice note"
          title="Voice note"
          disabled={isPending || formPending || isEnhancing}
          onClick={() => voiceDialogRef.current?.showModal()}
          data-testid="composer-primary"
        >
          <Mic className="size-4.5" />
        </Button>
      ) : (
        <Button
          size="icon"
          type="submit"
          name="intent"
          value={presentation.primaryAction.intent}
          aria-label={presentation.primaryAction.label}
          title={presentation.primaryAction.label}
          disabled={disabled}
          data-testid="composer-primary"
        >
          <ActionIcon icon={presentation.primaryAction.icon} />
        </Button>
      )}
    </div>
  );
});
