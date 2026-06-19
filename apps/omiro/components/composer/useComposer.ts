import { useNativeState } from '@expo/ui';
import { useCallback, useMemo, useState } from 'react';

import { resolveInitialComposerMessage } from '~/components/composer/composer-initial-message';
import { useComposerContext } from '~/components/composer/ComposerContext';

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

  const [message, setMessageState] = useState(() =>
    resolveInitialComposerMessage({ initialDraft, seedMessage }),
  );
  const messageState = useNativeState(message);

  const setMessage = useCallback(
    (nextMessage: string) => {
      messageState.value = nextMessage;
      setMessageState(nextMessage);
      onDraftChange?.(nextMessage);
    },
    [messageState, onDraftChange],
  );

  const uploadState = useMemo(
    () => ({ errors, isUploading, progressByAssetId }),
    [errors, isUploading, progressByAssetId],
  );

  const uploadedAttachmentIds = useMemo(
    () => attachments.flatMap((a) => (a.uploadedFile?.id ? [a.uploadedFile.id] : [])),
    [attachments],
  );

  const canSubmit = !isUploading && (message.trim().length > 0 || uploadedAttachmentIds.length > 0);

  const clearDraft = useCallback(() => {
    setMessage('');
    clearAttachments();
    onExtraClearDraft?.();
  }, [clearAttachments, onExtraClearDraft, setMessage]);

  return {
    message,
    messageState,
    setMessage,
    uploadState,
    uploadedAttachmentIds,
    canSubmit,
    clearDraft,
  };
}
