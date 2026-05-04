import { useCallback, useMemo, useState } from 'react';

import { useComposerContext } from '~/components/composer/ComposerContext';
import { useTextEnhance } from '~/services/ai/use-text-enhance';

interface UseComposerOptions {
  onExtraClearDraft?: () => void;
}

export function useComposer({ onExtraClearDraft }: UseComposerOptions = {}) {
  const { attachments, errors, isUploading, progressByAssetId, clearAttachments, seedMessage } =
    useComposerContext();

  const [message, setMessage] = useState(seedMessage ?? '');
  const { enhance, isEnhancing } = useTextEnhance();

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
  }, [clearAttachments, onExtraClearDraft]);

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
