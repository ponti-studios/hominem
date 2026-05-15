import { useCallback, useMemo, useState } from 'react';

import { useComposerContext } from '~/components/composer/ComposerContext';
import { useTextEnhance } from '~/services/ai/use-text-enhance';

interface UseComposerOptions {
  initialDraft?: string;
  onDraftChange?: (message: string) => void;
  onExtraClearDraft?: () => void;
}

export function useComposer({
  initialDraft,
  onDraftChange,
  onExtraClearDraft,
}: UseComposerOptions = {}) {
  const { attachments, errors, isUploading, progressByAssetId, clearAttachments, seedMessage } =
    useComposerContext();

  const [message, setMessageState] = useState(initialDraft ?? seedMessage ?? '');
  const { enhance, isEnhancing } = useTextEnhance();

  const setMessage = useCallback(
    (nextMessage: string) => {
      setMessageState(nextMessage);
      onDraftChange?.(nextMessage);
    },
    [onDraftChange],
  );

  const uploadState = useMemo(
    () => ({ errors, isUploading, progressByAssetId }),
    [errors, isUploading, progressByAssetId],
  );

  const uploadedAttachmentIds = useMemo(
    () => attachments.flatMap((a) => (a.uploadedFile?.id ? [a.uploadedFile.id] : [])),
    [attachments],
  );

  const canSubmit =
    !isUploading && (message.trim().length > 0 || uploadedAttachmentIds.length > 0);

  const clearDraft = useCallback(() => {
    setMessage('');
    clearAttachments();
    onExtraClearDraft?.();
  }, [clearAttachments, onExtraClearDraft, setMessage]);

  return {
    message,
    setMessage,
    uploadState,
    uploadedAttachmentIds,
    canSubmit,
    clearDraft,
    enhance,
    isEnhancing,
  };
}
