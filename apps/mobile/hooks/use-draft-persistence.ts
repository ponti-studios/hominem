import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@hominem/utils/logger';
import type { ComposerDraft } from '~/components/composer/composerState';

const DRAFT_STORAGE_KEY = 'mobile-composer-draft';
const DRAFT_SAVE_DEBOUNCE_MS = 5000;

export function useDraftPersistence(targetKey: string) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveTimeoutId, setSaveTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const getDraftKey = useCallback((key: string) => {
    return `${DRAFT_STORAGE_KEY}-${key}`;
  }, []);

  const saveDraft = useCallback(
    async (draft: ComposerDraft) => {
      const isEmpty =
        !draft.text.trim() &&
        draft.attachments.length === 0 &&
        draft.selectedNotes.length === 0;

      if (isEmpty) {
        try {
          await AsyncStorage.removeItem(getDraftKey(targetKey));
        } catch (error) {
          logger.error('[draft] failed to clear empty draft', error as Error);
        }
        return;
      }

      try {
        setIsSaving(true);
        await AsyncStorage.setItem(getDraftKey(targetKey), JSON.stringify(draft));
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
      if (saveTimeoutId) {
        clearTimeout(saveTimeoutId);
      }

      const newTimeoutId = setTimeout(() => {
        void saveDraft(draft);
      }, DRAFT_SAVE_DEBOUNCE_MS);

      setSaveTimeoutId(newTimeoutId);
    },
    [saveDraft, saveTimeoutId],
  );

  const restoreDraft = useCallback(async (): Promise<ComposerDraft | null> => {
    try {
      const draft = await AsyncStorage.getItem(getDraftKey(targetKey));
      if (draft) {
        const parsed = JSON.parse(draft) as ComposerDraft;
        return parsed;
      }
    } catch (error) {
      logger.error('[draft] failed to restore draft', error as Error);
    }
    return null;
  }, [targetKey, getDraftKey]);

  const clearDraft = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(getDraftKey(targetKey));
    } catch (error) {
      logger.error('[draft] failed to clear draft', error as Error);
    }
  }, [targetKey, getDraftKey]);

  useEffect(() => {
    return () => {
      if (saveTimeoutId) {
        clearTimeout(saveTimeoutId);
      }
    };
  }, [saveTimeoutId]);

  return {
    isSaving,
    debouncedSaveDraft,
    restoreDraft,
    clearDraft,
  };
}
