import type { NoteSearchResult } from '@hakumi/rpc/types';
import type { UploadedFile } from '~/types/upload';

type ComposerRouteKind = 'feed' | 'notes' | 'chat' | 'hidden';
export type ComposerMode = 'text' | 'voice';

export interface ComposerAttachment {
  id: string;
  name: string;
  type: string;
  localUri?: string;
  uploadedFile?: UploadedFile;
}

export type ComposerSelectedNote = NoteSearchResult;

export interface ComposerTarget {
  kind: ComposerRouteKind;
  key: string;
  chatId: string | null;
  noteId: string | null;
}

export interface ComposerDraft {
  text: string;
  attachments: ComposerAttachment[];
  selectedNotes: ComposerSelectedNote[];
}

export interface ComposerPresentation {
  placeholder: string;
  primaryActionLabel: string;
  secondaryActionLabel: string | null;
  showsAttachmentButton: boolean;
  showsVoiceButton: boolean;
  showsNoteChips: boolean;
  isCompact: boolean;
  isHidden: boolean;
}

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

export function createEmptyComposerDraft(): ComposerDraft {
  return {
    text: '',
    attachments: [],
    selectedNotes: [],
  };
}

export function resolveComposerTarget(
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
    return {
      kind: 'hidden',
      key: 'hidden',
      chatId: null,
      noteId: null,
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

export function deriveComposerPresentation(
  target: ComposerTarget,
  hasText: boolean,
  isRecording: boolean,
): ComposerPresentation {
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
      placeholder: isRecording ? 'Listening…' : 'Message',
      primaryActionLabel: 'Send',
      secondaryActionLabel: null,
      showsAttachmentButton: true,
      showsVoiceButton: true,
      showsNoteChips: true,
      isCompact: false,
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
