import { useLocalSearchParams, usePathname } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  createEmptyComposerDraft,
  resolveComposerTarget,
  type ComposerAttachment,
  type ComposerDraft,
  type ComposerSelectedNote,
  type ComposerTarget,
  type ComposerMode,
} from './composerState';
import { useDraftPersistence } from '~/hooks/use-draft-persistence';

type DraftUpdater = (draft: ComposerDraft) => ComposerDraft;

type ComposerContextValue = {
  target: ComposerTarget;
  message: string;
  setMessage: (value: string) => void;
  attachments: ComposerAttachment[];
  setAttachments: (
    value:
      | ComposerAttachment[]
      | ((currentValue: ComposerAttachment[]) => ComposerAttachment[]),
  ) => void;
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
  mode: ComposerMode;
  setMode: (value: ComposerMode) => void;
  selectedNotes: ComposerSelectedNote[];
  setSelectedNotes: (
    value:
      | ComposerSelectedNote[]
      | ((currentValue: ComposerSelectedNote[]) => ComposerSelectedNote[]),
  ) => void;
  addSelectedNote: (note: ComposerSelectedNote) => void;
  removeSelectedNote: (noteId: string) => void;
  clearDraft: () => void;
  composerClearance: number;
  setComposerClearance: (value: number) => void;
};

const ComposerContext = createContext<ComposerContextValue | null>(null);

export const useComposerContext = () => {
  const ctx = useContext(ComposerContext);
  if (!ctx) throw new Error('useComposerContext must be used within a ComposerProvider');
  return ctx;
};

export const ComposerProvider = ({ children }: PropsWithChildren) => {
  const pathname = usePathname();
  const params = useLocalSearchParams<{ chatId?: string | string[]; id?: string | string[] }>();
  const target = useMemo(
    () => resolveComposerTarget(pathname, params),
    [pathname, params.chatId, params.id],
  );
  const [drafts, setDrafts] = useState<Record<string, ComposerDraft>>(() => ({
    feed: createEmptyComposerDraft(),
  }));
  const [composerClearance, setComposerClearance] = useState(0);
  const activeDraft = drafts[target.key] ?? createEmptyComposerDraft();

  // Draft persistence
  const draftPersistence = useDraftPersistence(target.key);

  // Restore draft from storage on target change
  useEffect(() => {
    const restoreSavedDraft = async () => {
      const savedDraft = await draftPersistence.restoreDraft();
      if (savedDraft) {
        setDrafts((currentDrafts) => ({
          ...currentDrafts,
          [target.key]: savedDraft,
        }));
      }
    };
    void restoreSavedDraft();
  }, [target.key, draftPersistence]);

  // Save draft to storage whenever it changes (debounced)
  useEffect(() => {
    if (target.kind === 'hidden') {
      return;
    }
    draftPersistence.debouncedSaveDraft(activeDraft);
  }, [activeDraft, target.kind, draftPersistence]);

  const updateDraft = useCallback(
    (updater: DraftUpdater) => {
      setDrafts((currentDrafts) => {
        const currentDraft = currentDrafts[target.key] ?? createEmptyComposerDraft();
        return {
          ...currentDrafts,
          [target.key]: updater(currentDraft),
        };
      });
    },
    [target.key],
  );

  const setMessage = useCallback(
    (value: string) => {
      updateDraft((draft) => ({
        ...draft,
        text: value,
      }));
    },
    [updateDraft],
  );

  const setAttachments = useCallback<ComposerContextValue['setAttachments']>(
    (value) => {
      updateDraft((draft) => ({
        ...draft,
        attachments: typeof value === 'function' ? value(draft.attachments) : value,
      }));
    },
    [updateDraft],
  );

  const setIsRecording = useCallback(
    (value: boolean) => {
      updateDraft((draft) => ({
        ...draft,
        isRecording: value,
      }));
    },
    [updateDraft],
  );

  const setMode = useCallback(
    (value: ComposerMode) => {
      updateDraft((draft) => ({
        ...draft,
        mode: value,
      }));
    },
    [updateDraft],
  );

  const setSelectedNotes = useCallback<ComposerContextValue['setSelectedNotes']>(
    (value) => {
      updateDraft((draft) => ({
        ...draft,
        selectedNotes: typeof value === 'function' ? value(draft.selectedNotes) : value,
      }));
    },
    [updateDraft],
  );

  const addSelectedNote = useCallback(
    (note: ComposerSelectedNote) => {
      updateDraft((draft) => ({
        ...draft,
        selectedNotes: draft.selectedNotes.some((currentNote) => currentNote.id === note.id)
          ? draft.selectedNotes
          : [...draft.selectedNotes, note],
      }));
    },
    [updateDraft],
  );

  const removeSelectedNote = useCallback(
    (noteId: string) => {
      updateDraft((draft) => ({
        ...draft,
        selectedNotes: draft.selectedNotes.filter((currentNote) => currentNote.id !== noteId),
      }));
    },
    [updateDraft],
  );

  const clearDraft = useCallback(() => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [target.key]: createEmptyComposerDraft(),
    }));
    void draftPersistence.clearDraft();
  }, [target.key, draftPersistence]);

  const value = useMemo<ComposerContextValue>(
    () => ({
      target,
      message: activeDraft.text,
      setMessage,
      attachments: activeDraft.attachments,
      setAttachments,
      isRecording: activeDraft.isRecording,
      setIsRecording,
      mode: activeDraft.mode,
      setMode,
      selectedNotes: activeDraft.selectedNotes,
      setSelectedNotes,
      addSelectedNote,
      removeSelectedNote,
      clearDraft,
      composerClearance,
      setComposerClearance,
    }),
    [
      activeDraft.attachments,
      activeDraft.isRecording,
      activeDraft.mode,
      activeDraft.selectedNotes,
      addSelectedNote,
      activeDraft.text,
      clearDraft,
      composerClearance,
      removeSelectedNote,
      setAttachments,
      setComposerClearance,
      setIsRecording,
      setMessage,
      setMode,
      setSelectedNotes,
      target,
    ],
  );

  return <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>;
};
