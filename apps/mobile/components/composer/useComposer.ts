import { useApiClient } from '@hominem/rpc/react';
import { NoteSearchResult } from '@hominem/rpc/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  canSubmitComposerDraft,
  getUploadedAttachmentIds,
} from '~/components/composer/composerActions';
import { useComposerContext } from '~/components/composer/ComposerContext';
import { useTextEnhance } from '~/services/ai/use-text-enhance';

interface UseComposerOptions {
  selectedNotes?: NoteSearchResult[];
  onExtraClearDraft?: () => void;
}

export function useComposer({ selectedNotes = [], onExtraClearDraft }: UseComposerOptions = {}) {
  const client = useApiClient();
  const context = useComposerContext();

  const [message, setMessage] = useState(context.seedMessage ?? '');

  const { enhance, isEnhancing } = useTextEnhance();

  useEffect(() => {
    const clientRef = client;
    context.setOnRemove((id: string) => {
      const target = context.attachments.find((a) => a.id === id);
      context.setAttachments((prev) => prev.filter((a) => a.id !== id));
      if (target?.uploadedFile?.id) {
        void clientRef.api.files[':fileId']
          .$delete({ param: { fileId: target.uploadedFile.id } })
          .catch(() => undefined);
      }
    });
  });

  const uploadState = useMemo(
    () => ({
      errors: context.errors,
      isUploading: context.isUploading,
      progressByAssetId: context.progressByAssetId,
    }),
    [context.errors, context.isUploading, context.progressByAssetId],
  );

  const uploadedAttachmentIds = useMemo(
    () => getUploadedAttachmentIds(context.attachments),
    [context.attachments],
  );

  const canSubmit = canSubmitComposerDraft({
    isUploading: context.isUploading,
    message,
    uploadedAttachmentIds,
    selectedNotes,
  });

  const clearDraft = useCallback(() => {
    setMessage('');
    context.setAttachments([]);
    onExtraClearDraft?.();
  }, [context, onExtraClearDraft]);

  return {
    // state
    message,
    setMessage,
    // upload
    uploadState,
    uploadedAttachmentIds,
    // derived
    canSubmit,
    // callbacks
    clearDraft,
    // enhance
    enhance,
    isEnhancing,
  };
}
