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

import { useDraftPersistence } from '~/hooks/use-draft-persistence';

import {
  createEmptyComposerDraft,
  resolveComposerTarget,
  type ComposerAttachment,
  type ComposerDraft,
  type ComposerMode,
  type ComposerSelectedNote,
  type ComposerTarget,
} from './composerState';

type DraftUpdater = (draft: ComposerDraft) => ComposerDraft;

type ComposerDraftContextValue = {
  target: ComposerTarget;
  message: string;
  setMessage: (value: string) => void;
  attachments: ComposerAttachment[];
  setAttachments: (
    value: ComposerAttachment[] | ((currentValue: ComposerAttachment[]) => ComposerAttachment[]),
  ) => void;
  selectedNotes: ComposerSelectedNote[];
  setSelectedNotes: (
    value:
      | ComposerSelectedNote[]
      | ((currentValue: ComposerSelectedNote[]) => ComposerSelectedNote[]),
  ) => void;
  addSelectedNote: (note: ComposerSelectedNote) => void;
  removeSelectedNote: (noteId: string) => void;
  clearDraft: () => void;
};

type ComposerUIContextValue = {
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
  mode: ComposerMode;
  setMode: (value: ComposerMode) => void;
  composerClearance: number;
  setComposerClearance: (value: number) => void;
};

const ComposerDraftContext = createContext<ComposerDraftContextValue | null>(null);
const ComposerUIContext = createContext<ComposerUIContextValue | null>(null);

export const useComposerContext = () => {
  const draftCtx = useContext(ComposerDraftContext);
  const uiCtx = useContext(ComposerUIContext);
  if (!draftCtx || !uiCtx) {
    throw new Error('useComposerContext must be used within a ComposerProvider');
  }
  return { ...draftCtx, ...uiCtx };
};

export const useComposerDraftContext = () => {
  const ctx = useContext(ComposerDraftContext);
  if (!ctx) throw new Error('useComposerDraftContext must be used within a ComposerProvider');
  return ctx;
};

export const useComposerUIContext = () => {
  const ctx = useContext(ComposerUIContext);
  if (!ctx) throw new Error('useComposerUIContext must be used within a ComposerProvider');
  return ctx;
};

export const ComposerProvider = ({ children }: PropsWithChildren) => {
  const pathname = usePathname();
  const params = useLocalSearchParams<{ chatId?: string | string[]; id?: string | string[] }>();

  const chatId = typeof params.chatId === 'string' ? params.chatId : params.chatId?.[0];
  const id = typeof params.id === 'string' ? params.id : params.id?.[0];

  const target = useMemo(
    () => resolveComposerTarget(pathname, { chatId, id }),
    [pathname, chatId, id],
  );

  const [drafts, setDrafts] = useState<Record<string, ComposerDraft>>(() => ({
    feed: createEmptyComposerDraft(),
  }));

  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<ComposerMode>('text');
  const [composerClearance, setComposerClearance] = useState(0);

  const activeDraft = drafts[target.key] ?? createEmptyComposerDraft();

  const {
    restoreDraft,
    debouncedSaveDraft,
    clearDraft: clearPersistedDraft,
  } = useDraftPersistence(target.key);

  useEffect(() => {
    const savedDraft = restoreDraft();
    if (savedDraft) {
      setDrafts((currentDrafts) => ({
        ...currentDrafts,
        [target.key]: savedDraft,
      }));
    }
  }, [restoreDraft, target.key]);

  useEffect(() => {
    if (target.kind === 'hidden') {
      return;
    }
    debouncedSaveDraft(activeDraft);
  }, [activeDraft, debouncedSaveDraft, target.kind]);

  useEffect(() => {
    setIsRecording(false);
    setMode('text');
  }, [target.key]);

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
      updateDraft((draft) => ({ ...draft, text: value }));
    },
    [updateDraft],
  );

  const setAttachments = useCallback<ComposerDraftContextValue['setAttachments']>(
    (value) => {
      updateDraft((draft) => ({
        ...draft,
        attachments: typeof value === 'function' ? value(draft.attachments) : value,
      }));
    },
    [updateDraft],
  );

  const setSelectedNotes = useCallback<ComposerDraftContextValue['setSelectedNotes']>(
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
        selectedNotes: draft.selectedNotes.some((n) => n.id === note.id)
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
        selectedNotes: draft.selectedNotes.filter((n) => n.id !== noteId),
      }));
    },
    [updateDraft],
  );

  const clearDraft = useCallback(() => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [target.key]: createEmptyComposerDraft(),
    }));
    clearPersistedDraft();
  }, [clearPersistedDraft, target.key]);

  const draftValue = useMemo<ComposerDraftContextValue>(
    () => ({
      target,
      message: activeDraft.text,
      setMessage,
      attachments: activeDraft.attachments,
      setAttachments,
      selectedNotes: activeDraft.selectedNotes,
      setSelectedNotes,
      addSelectedNote,
      removeSelectedNote,
      clearDraft,
    }),
    [
      target,
      activeDraft.text,
      setMessage,
      activeDraft.attachments,
      setAttachments,
      activeDraft.selectedNotes,
      setSelectedNotes,
      addSelectedNote,
      removeSelectedNote,
      clearDraft,
    ],
  );

  const uiValue = useMemo<ComposerUIContextValue>(
    () => ({
      isRecording,
      setIsRecording,
      mode,
      setMode,
      composerClearance,
      setComposerClearance,
    }),
    [isRecording, mode, composerClearance, setIsRecording, setMode, setComposerClearance],
  );

  return (
    <ComposerDraftContext.Provider value={draftValue}>
      <ComposerUIContext.Provider value={uiValue}>{children}</ComposerUIContext.Provider>
    </ComposerDraftContext.Provider>
  );
};
