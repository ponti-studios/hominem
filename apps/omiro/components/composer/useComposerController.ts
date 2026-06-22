import { useCallback } from 'react';

import { useComposerAttachments } from '~/components/composer/ComposerContext';
import { useComposerDraft } from '~/components/composer/useComposerDraft';
import { useVoiceComposerInput } from '~/components/composer/useVoiceComposerInput';
import { useInlineEnhance } from '~/services/ai';

interface UseComposerControllerOptions {
  hydrationKey: string;
  initialMessage?: string;
  isSubmitting?: boolean;
  onDraftChange?: (message: string) => void;
  onClearDraft?: () => void;
}

export function useComposerController({
  hydrationKey,
  initialMessage,
  isSubmitting = false,
  onDraftChange,
  onClearDraft,
}: UseComposerControllerOptions) {
  const {
    getMessage,
    message,
    setMessage,
    clearDraft: clearTextDraft,
  } = useComposerDraft({
    initialMessage,
    hydrationKey,
    onDraftChange,
  });
  const { attachments, errors, isUploading, clearAttachments } = useComposerAttachments();
  const uploadedAttachmentIds = attachments.flatMap((attachment) =>
    attachment.uploadedFile?.id ? [attachment.uploadedFile.id] : [],
  );
  const hasContent = message.trim().length > 0 || uploadedAttachmentIds.length > 0;

  const {
    handleVoicePress,
    isBusy: isVoiceBusy,
    isCleaningVoice,
    isRecording,
    error: voiceError,
    clearError: clearVoiceError,
  } = useVoiceComposerInput({ getMessage, setMessage });

  const {
    isEnhanceOpen,
    enhanceInstruction,
    setEnhanceInstruction,
    enhanceError,
    isEnhancing,
    toggleEnhance,
    closeEnhance,
    runEnhance,
  } = useInlineEnhance();

  const isInteractionBusy = isSubmitting || isUploading || isVoiceBusy || isEnhancing;
  const canSubmit = hasContent && !isInteractionBusy;
  const canOpenEnhance = hasContent && !isInteractionBusy && !isCleaningVoice;
  const canPickMedia = !isInteractionBusy;
  const canToggleVoice = isRecording || (!isInteractionBusy && !isCleaningVoice);
  const showAttachments = attachments.length > 0 || errors.length > 0 || isUploading;

  const clearComposer = useCallback(() => {
    clearTextDraft();
    clearAttachments();
    closeEnhance();
    onClearDraft?.();
  }, [clearAttachments, clearTextDraft, closeEnhance, onClearDraft]);

  return {
    message,
    setMessage,
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
    handleVoicePress,
    isVoiceBusy,
    isCleaningVoice,
    isRecording,
    voiceError,
    clearVoiceError,
    isEnhanceOpen,
    enhanceInstruction,
    setEnhanceInstruction,
    enhanceError,
    isEnhancing,
    toggleEnhance,
    closeEnhance,
    runEnhance,
    clearComposer,
  };
}
