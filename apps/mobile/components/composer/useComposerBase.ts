import { useApiClient } from '@hominem/rpc/react';
import { useCallback, useMemo, useState } from 'react';

import { canSubmitComposerDraft, getUploadedAttachmentIds } from '~/components/composer/composerActions';
import type { ComposerAttachment, ComposerSelectedNote } from '~/components/composer/composerState';
import { useComposerMediaActions } from '~/components/composer/useComposerMediaActions';
import { useTextEnhance } from '~/services/ai/use-text-enhance';

interface UseComposerBaseOptions {
  seedMessage?: string;
  selectedNotes?: ComposerSelectedNote[];
  onExtraClearDraft?: () => void;
}

export function useComposerBase({
  seedMessage,
  selectedNotes = [],
  onExtraClearDraft,
}: UseComposerBaseOptions = {}) {
  const client = useApiClient();

  const [message, setMessage] = useState(seedMessage ?? '');
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);

  const { enhance, isEnhancing } = useTextEnhance();
  const {
    handleCameraCapture,
    pickAttachment,
    uploadState,
  } = useComposerMediaActions({
    attachments,
    setAttachments,
  });

  const uploadedAttachmentIds = useMemo(
    () => getUploadedAttachmentIds(attachments),
    [attachments],
  );

  const canSubmit = canSubmitComposerDraft({
    isUploading: uploadState.isUploading,
    message,
    uploadedAttachmentIds,
    selectedNotes,
  });

  const clearDraft = useCallback(() => {
    setMessage('');
    setAttachments([]);
    onExtraClearDraft?.();
  }, [onExtraClearDraft]);

  const handleRemoveAttachment = useCallback(
    (id: string) => {
      const target = attachments.find((a) => a.id === id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      if (target?.uploadedFile?.id) {
        void client.api.files[':fileId']
          .$delete({ param: { fileId: target.uploadedFile.id } })
          .catch(() => undefined);
      }
    },
    [attachments, client],
  );

  return {
    // state
    message,
    setMessage,
    attachments,
    // upload
    uploadState,
    uploadedAttachmentIds,
    // derived
    canSubmit,
    // callbacks
    clearDraft,
    handleRemoveAttachment,
    pickAttachment,
    handleCameraCapture,
    // enhance
    enhance,
    isEnhancing,
  };
}
