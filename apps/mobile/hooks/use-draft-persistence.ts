import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@hominem/utils/logger';

const DRAFT_STORAGE_KEY = 'mobile-composer-draft';
const DRAFT_SAVE_DEBOUNCE_MS = 5000;

export interface ComposerDraft {
  message: string;
  timestamp: number;
}

export function useDraftPersistence(target: string | null) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveTimeoutId, setSaveTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const getDraftKey = useCallback((t: string | null) => {
    return t ? `${DRAFT_STORAGE_KEY}-${t}` : DRAFT_STORAGE_KEY;
  }, []);

  const saveDraft = useCallback(
    async (message: string) => {
      if (!message.trim()) {
        try {
          await AsyncStorage.removeItem(getDraftKey(target));
        } catch (error) {
          logger.error('[draft] failed to clear empty draft', error as Error);
        }
        return;
      }

      try {
        setIsSaving(true);
        const draft: ComposerDraft = {
          message,
          timestamp: Date.now(),
        };
        await AsyncStorage.setItem(getDraftKey(target), JSON.stringify(draft));
      } catch (error) {
        logger.error('[draft] failed to save draft', error as Error);
      } finally {
        setIsSaving(false);
      }
    },
    [target, getDraftKey],
  );

  const debouncedSaveDraft = useCallback(
    (message: string) => {
      if (saveTimeoutId) {
        clearTimeout(saveTimeoutId);
      }

      const newTimeoutId = setTimeout(() => {
        void saveDraft(message);
      }, DRAFT_SAVE_DEBOUNCE_MS);

      setSaveTimeoutId(newTimeoutId);
    },
    [saveDraft, saveTimeoutId],
  );

  const restoreDraft = useCallback(async (): Promise<string | null> => {
    try {
      const draft = await AsyncStorage.getItem(getDraftKey(target));
      if (draft) {
        const parsed = JSON.parse(draft) as ComposerDraft;
        return parsed.message || null;
      }
    } catch (error) {
      logger.error('[draft] failed to restore draft', error as Error);
    }
    return null;
  }, [target, getDraftKey]);

  const clearDraft = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(getDraftKey(target));
    } catch (error) {
      logger.error('[draft] failed to clear draft', error as Error);
    }
  }, [target, getDraftKey]);

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
