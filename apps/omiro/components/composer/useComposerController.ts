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
  const {
    getMessage,
    message,
    setMessage,
    clearDraft: clearTextDraft,
  } = useComposerDraft({
    initialMessage,
    onDraftChange,
  });
  const { attachments, errors, isUploading, clearAttachments } = useComposerAttachments();
  const uploadedAttachmentIds = attachments.flatMap((attachment) =>
    attachment.uploadedFile?.id ? [attachment.uploadedFile.id] : [],
  );
  const hasContent = message.trim().length > 0 || uploadedAttachmentIds.length > 0;

  const {
    handleVoicePress,
    cancelVoiceRecording,
    isBusy: isVoiceBusy,
    isCleaningVoice,
    isRecording,
    isRecordingElsewhere,
    recordingStartedAt,
    voiceState,
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
  const canToggleVoice =
    isRecording || (!isInteractionBusy && !isCleaningVoice && !isRecordingElsewhere);
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
    cancelVoiceRecording,
    isVoiceBusy,
    isCleaningVoice,
    isRecording,
    isRecordingElsewhere,
    recordingStartedAt,
    voiceState,
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
