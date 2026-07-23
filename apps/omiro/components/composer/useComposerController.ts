import { useCallback } from 'react';

import { useComposerAttachments } from '~/components/composer/ComposerContext';
import { useComposerDraft } from '~/components/composer/useComposerDraft';
import { useVoiceComposerInput } from '~/components/composer/useVoiceComposerInput';
import { useInlineEnhance } from '~/services/ai';

interface UseComposerControllerOptions {
  initialMessage?: string;
  isSubmitting?: boolean;
  onDraftChange?: (message: string) => void;
  onClearDraft?: () => void;
}

export function useComposerController({
  initialMessage,
  isSubmitting = false,
  onDraftChange,
  onClearDraft,
}: UseComposerControllerOptions) {
  const draft = useComposerDraft({ initialMessage, onDraftChange });
  const { attachments, errors, isUploading, clearAttachments } = useComposerAttachments();
  const uploadedAttachmentIds = attachments.flatMap((attachment) =>
    attachment.uploadedFile?.id ? [attachment.uploadedFile.id] : [],
  );
  const hasContent = draft.message.trim().length > 0 || uploadedAttachmentIds.length > 0;

  const voice = useVoiceComposerInput({
    getMessage: draft.getMessage,
    setMessage: draft.setMessage,
  });
  const enhance = useInlineEnhance();

  const isInteractionBusy = isSubmitting || isUploading || voice.isBusy || enhance.isEnhancing;
  const canSubmit = hasContent && !isInteractionBusy;
  const canOpenEnhance = hasContent && !isInteractionBusy && !voice.isCleaningVoice;
  const canPickMedia = !isInteractionBusy;
  const canToggleVoice =
    voice.isRecording ||
    (!isInteractionBusy && !voice.isCleaningVoice && !voice.isRecordingElsewhere);
  const showAttachments = attachments.length > 0 || errors.length > 0 || isUploading;

  const clearComposer = useCallback(() => {
    draft.clearDraft();
    clearAttachments();
    enhance.closeEnhance();
    onClearDraft?.();
  }, [clearAttachments, draft.clearDraft, enhance.closeEnhance, onClearDraft]);

  return {
    message: draft.message,
    setMessage: draft.setMessage,
    attachments,
    errors,
    isUploading,
    showAttachments,
    uploadedAttachmentIds,
    canSubmit,
    canOpenEnhance,
    canPickMedia,
    canToggleVoice,
    isInteractionBusy,
    voice,
    enhance,
    clearComposer,
  };
}
