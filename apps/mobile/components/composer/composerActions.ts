import type { Note } from '@hominem/rpc/types';

import {
  DEFAULT_CHAT_TITLE,
  isDefaultChatTitle,
  normalizeChatTitle,
} from '~/services/chat/chat-title';

import type { ComposerTarget, ComposerAttachment, ComposerSelectedNote } from './composerState';

export type ComposerPrimaryAction = 'send_chat' | 'create_note';

export function getUploadedAttachmentIds(attachments: ComposerAttachment[]) {
  return attachments.flatMap((attachment) =>
    attachment.uploadedFile?.id ? [attachment.uploadedFile.id] : [],
  );
}

export function mergeNoteIntoCache(currentNotes: Note[] | undefined, updatedNote: Note) {
  if (!currentNotes) {
    return [updatedNote];
  }

  const hasNote = currentNotes.some((note) => note.id === updatedNote.id);
  if (!hasNote) {
    return [updatedNote, ...currentNotes];
  }

  return currentNotes.map((note) => (note.id === updatedNote.id ? updatedNote : note));
}

export function resolveComposerPrimaryAction(
  targetKind: ComposerTarget['kind'],
): ComposerPrimaryAction | null {
  if (targetKind === 'chat') {
    return 'send_chat';
  }

  if (targetKind === 'feed' || targetKind === 'notes') {
    return 'create_note';
  }

  return null;
}

export function resolveComposerSecondaryAction(
  targetKind: ComposerTarget['kind'],
): 'create_chat' | null {
  return targetKind === 'feed' ? 'create_chat' : null;
}

export function canSubmitComposerDraft(input: {
  isUploading: boolean;
  message: string;
  uploadedAttachmentIds: string[];
  selectedNotes: ComposerSelectedNote[];
}) {
  return (
    !input.isUploading &&
    (input.message.trim().length > 0 ||
      input.uploadedAttachmentIds.length > 0 ||
      input.selectedNotes.length > 0)
  );
}

export function buildChatTitle(message: string) {
  return normalizeChatTitle(message);
}

export { DEFAULT_CHAT_TITLE, isDefaultChatTitle, normalizeChatTitle };

export function buildNoteContent(noteContent: string, message: string) {
  const trimmedMessage = message.trim();

  if (trimmedMessage.length === 0) {
    return noteContent;
  }

  return noteContent.trim().length > 0 ? `${noteContent}\n\n${trimmedMessage}` : trimmedMessage;
}

export function mergeUniqueIds(existingIds: string[], nextIds: string[]) {
  return Array.from(new Set([...existingIds, ...nextIds]));
}

export function getSelectedNoteIds(selectedNotes: ComposerSelectedNote[]) {
  return selectedNotes.map((note) => note.id);
}
