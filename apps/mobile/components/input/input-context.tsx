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
  deriveMobileComposerPresentation,
  resolveComposerTarget,
  type MobileComposerAttachment,
  type ComposerDraft,
  type ComposerTarget,
  type MobileComposerPresentation,
  type MobileComposerMode,
} from './composer-state';

type DraftUpdater = (draft: ComposerDraft) => ComposerDraft;

type InputContextValue = {
  target: ComposerTarget;
  message: string;
  setMessage: (value: string) => void;
  attachments: MobileComposerAttachment[];
  setAttachments: (
    value:
      | MobileComposerAttachment[]
      | ((currentValue: MobileComposerAttachment[]) => MobileComposerAttachment[]),
  ) => void;
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
  mode: MobileComposerMode;
  setMode: (value: MobileComposerMode) => void;
  selectedNoteIds: string[];
  setSelectedNoteIds: (value: string[] | ((currentValue: string[]) => string[])) => void;
  toggleSelectedNoteId: (noteId: string) => void;
  clearDraft: () => void;
};

const InputContext = createContext<InputContextValue | null>(null);

export const useInputContext = () => {
  const ctx = useContext(InputContext);
  if (!ctx) throw new Error('useInputContext must be used within an InputProvider');
  return ctx;
};

export const InputProvider = ({ children }: PropsWithChildren) => {
  const pathname = usePathname();
  const params = useLocalSearchParams<{ chatId?: string | string[]; id?: string | string[] }>();
  const target = useMemo(
    () => resolveComposerTarget(pathname, params),
    [pathname, params.chatId, params.id],
  );
  const [drafts, setDrafts] = useState<Record<string, ComposerDraft>>(() => ({
    feed: createEmptyComposerDraft(),
  }));
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

  const setAttachments = useCallback<InputContextValue['setAttachments']>(
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
    (value: MobileComposerMode) => {
      updateDraft((draft) => ({
        ...draft,
        mode: value,
      }));
    },
    [updateDraft],
  );

  const setSelectedNoteIds = useCallback<InputContextValue['setSelectedNoteIds']>(
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

  const value = useMemo<InputContextValue>(
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
    }),
    [
      activeDraft.attachments,
      activeDraft.isRecording,
      activeDraft.mode,
      activeDraft.selectedNoteIds,
      activeDraft.text,
      clearDraft,
      setAttachments,
      setIsRecording,
      setMessage,
      setMode,
      setSelectedNoteIds,
      target,
      toggleSelectedNoteId,
    ],
  );

  return <InputContext.Provider value={value}>{children}</InputContext.Provider>;
};
