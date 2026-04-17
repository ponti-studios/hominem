import { logger } from '@hominem/utils/logger';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ComposerDraft } from '~/components/composer/composerState';
import { storage } from '~/services/storage/mmkv';

const DRAFT_STORAGE_KEY = 'mobile-composer-draft';
const DRAFT_SAVE_DEBOUNCE_MS = 5000;

export function useDraftPersistence(targetKey: string) {
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getDraftKey = useCallback((key: string) => {
    return `${DRAFT_STORAGE_KEY}-${key}`;
  }, []);

  const saveDraft = useCallback(
    (draft: ComposerDraft) => {
      const isEmpty =
        !draft.text.trim() && draft.attachments.length === 0 && draft.selectedNotes.length === 0;

      if (isEmpty) {
        try {
          storage.remove(getDraftKey(targetKey));
        } catch (error) {
          logger.error('[draft] failed to clear empty draft', error as Error);
        }
        return;
      }

      try {
        setIsSaving(true);
        storage.set(getDraftKey(targetKey), JSON.stringify(draft));
      } catch (error) {
        logger.error('[draft] failed to save draft', error as Error);
      } finally {
        setIsSaving(false);
      }
    },
    [targetKey, getDraftKey],
  );

  const debouncedSaveDraft = useCallback(
    (draft: ComposerDraft) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveDraft(draft);
      }, DRAFT_SAVE_DEBOUNCE_MS);
    },
    [saveDraft],
  );

  const restoreDraft = useCallback((): ComposerDraft | null => {
    try {
      const draft = storage.getString(getDraftKey(targetKey));
      if (draft) {
        return JSON.parse(draft) as ComposerDraft;
      }
    } catch (error) {
      logger.error('[draft] failed to restore draft', error as Error);
    }
    return null;
  }, [targetKey, getDraftKey]);

  const clearDraft = useCallback(() => {
    try {
      storage.remove(getDraftKey(targetKey));
    } catch (error) {
      logger.error('[draft] failed to clear draft', error as Error);
    }
  }, [targetKey, getDraftKey]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    isSaving,
    debouncedSaveDraft,
    restoreDraft,
    clearDraft,
  };
}
