import type { UploadedFile } from '@hominem/ui/types/upload';
import { useLocalSearchParams, usePathname } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

type ComposerRouteKind = 'feed' | 'notes' | 'chat' | 'note' | 'hidden';
type MobileComposerMode = 'text' | 'voice';

interface ComposerTarget {
  kind: ComposerRouteKind;
  key: string;
  chatId: string | null;
  noteId: string | null;
}

export interface MobileComposerAttachment {
  id: string;
  name: string;
  type: string;
  localUri?: string;
  uploadedFile?: UploadedFile;
}

interface ComposerDraft {
  text: string;
  attachments: MobileComposerAttachment[];
  isRecording: boolean;
  mode: MobileComposerMode;
  selectedNoteIds: string[];
}

interface MobileComposerPresentation {
  placeholder: string;
  primaryActionLabel: string;
  secondaryActionLabel: string | null;
  showsAttachmentButton: boolean;
  showsVoiceButton: boolean;
  showsNoteChips: boolean;
  isCompact: boolean;
  isHidden: boolean;
}

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

function getParamValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getPathSegment(pathname: string, marker: '/chat/' | '/notes/'): string | null {
  const index = pathname.indexOf(marker);

  if (index < 0) {
    return null;
  }

  const trailing = pathname.slice(index + marker.length);
  const [segment = ''] = trailing.split('/');
  return segment.length > 0 ? segment : null;
}

function createEmptyComposerDraft(): ComposerDraft {
  return {
    text: '',
    attachments: [],
    isRecording: false,
    mode: 'text',
    selectedNoteIds: [],
  };
}

function resolveComposerTarget(
  pathname: string,
  params: { chatId?: string | string[]; id?: string | string[] } = {},
): ComposerTarget {
  if (pathname.includes('/settings')) {
    return {
      kind: 'hidden',
      key: 'hidden',
      chatId: null,
      noteId: null,
    };
  }

  if (pathname.includes('/chat/')) {
    const chatId =
      getParamValue(params.chatId) ??
      getParamValue(params.id) ??
      getPathSegment(pathname, '/chat/');

    return {
      kind: chatId ? 'chat' : 'hidden',
      key: chatId ? `chat:${chatId}` : 'hidden',
      chatId,
      noteId: null,
    };
  }

  if (pathname.includes('/notes/')) {
    const noteId = getParamValue(params.id) ?? getPathSegment(pathname, '/notes/');

    return {
      kind: noteId ? 'note' : 'hidden',
      key: noteId ? `note:${noteId}` : 'hidden',
      chatId: null,
      noteId,
    };
  }

  if (pathname.endsWith('/notes') || pathname.includes('/notes?')) {
    return {
      kind: 'notes',
      key: 'notes',
      chatId: null,
      noteId: null,
    };
  }

  return {
    kind: 'feed',
    key: 'feed',
    chatId: null,
    noteId: null,
  };
}

export function deriveMobileComposerPresentation(
  target: ComposerTarget,
  hasText: boolean,
  isRecording: boolean,
): MobileComposerPresentation {
  if (target.kind === 'hidden') {
    return {
      placeholder: '',
      primaryActionLabel: '',
      secondaryActionLabel: null,
      showsAttachmentButton: false,
      showsVoiceButton: false,
      showsNoteChips: false,
      isCompact: false,
      isHidden: true,
    };
  }

  if (target.kind === 'chat') {
    return {
      placeholder: isRecording ? 'Listening…' : 'Ask something about your notes...',
      primaryActionLabel: hasText ? 'Send' : 'Send',
      secondaryActionLabel: null,
      showsAttachmentButton: true,
      showsVoiceButton: true,
      showsNoteChips: true,
      isCompact: false,
      isHidden: false,
    };
  }

  if (target.kind === 'note') {
    return {
      placeholder: isRecording ? 'Listening…' : 'Append to this note...',
      primaryActionLabel: 'Append',
      secondaryActionLabel: null,
      showsAttachmentButton: true,
      showsVoiceButton: true,
      showsNoteChips: false,
      isCompact: true,
      isHidden: false,
    };
  }

  if (target.kind === 'notes') {
    return {
      placeholder: isRecording ? 'Listening…' : 'Write into your notes…',
      primaryActionLabel: 'Save note',
      secondaryActionLabel: null,
      showsAttachmentButton: true,
      showsVoiceButton: true,
      showsNoteChips: false,
      isCompact: false,
      isHidden: false,
    };
  }

  return {
    placeholder: isRecording ? 'Listening…' : 'Write a note, ask something, or drop a file',
    primaryActionLabel: 'Save note',
    secondaryActionLabel: 'Start chat',
    showsAttachmentButton: true,
    showsVoiceButton: true,
    showsNoteChips: false,
    isCompact: false,
    isHidden: false,
  };
}

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
