import { useLocalSearchParams, usePathname } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  createEmptyComposerDraft,
  resolveComposerTarget,
  type ComposerAttachment,
  type ComposerDraft,
  type ComposerTarget,
  type ComposerMode,
} from './composerState';

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
  selectedNoteIds: string[];
  setSelectedNoteIds: (value: string[] | ((currentValue: string[]) => string[])) => void;
  toggleSelectedNoteId: (noteId: string) => void;
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

  const setSelectedNoteIds = useCallback<ComposerContextValue['setSelectedNoteIds']>(
    (value) => {
      updateDraft((draft) => ({
        ...draft,
        selectedNoteIds: typeof value === 'function' ? value(draft.selectedNoteIds) : value,
      }));
    },
    [updateDraft],
  );

  const toggleSelectedNoteId = useCallback(
    (noteId: string) => {
      updateDraft((draft) => ({
        ...draft,
        selectedNoteIds: draft.selectedNoteIds.includes(noteId)
          ? draft.selectedNoteIds.filter((currentNoteId) => currentNoteId !== noteId)
          : [...draft.selectedNoteIds, noteId],
      }));
    },
    [updateDraft],
  );

  const clearDraft = useCallback(() => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [target.key]: createEmptyComposerDraft(),
    }));
  }, [target.key]);

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
      selectedNoteIds: activeDraft.selectedNoteIds,
      setSelectedNoteIds,
      toggleSelectedNoteId,
      clearDraft,
      composerClearance,
      setComposerClearance,
    }),
    [
      activeDraft.attachments,
      activeDraft.isRecording,
      activeDraft.mode,
      activeDraft.selectedNoteIds,
      activeDraft.text,
      clearDraft,
      composerClearance,
      setAttachments,
      setComposerClearance,
      setIsRecording,
      setMessage,
      setMode,
      setSelectedNoteIds,
      target,
      toggleSelectedNoteId,
    ],
  );

  return <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>;
};
