import { NoteSearchResult } from '@hominem/rpc/types';

import { DEFAULT_CHAT_TITLE, isDefaultChatTitle } from '~/services/chat/chat-title';

import type { ComposerAttachment } from './composerState';

export function getUploadedAttachmentIds(attachments: ComposerAttachment[]) {
  return attachments.flatMap((attachment) =>
    attachment.uploadedFile?.id ? [attachment.uploadedFile.id] : [],
  );
}

export function canSubmitComposerDraft(input: {
  isUploading: boolean;
  message: string;
  uploadedAttachmentIds: string[];
  selectedNotes: NoteSearchResult[];
}) {
  return (
    !input.isUploading &&
    (input.message.trim().length > 0 ||
      input.uploadedAttachmentIds.length > 0 ||
      input.selectedNotes.length > 0)
  );
}

export { DEFAULT_CHAT_TITLE, isDefaultChatTitle };

export function mergeUniqueIds(existingIds: string[], nextIds: string[]) {
  return Array.from(new Set([...existingIds, ...nextIds]));
}

export function getNoteIds(notes: NoteSearchResult[]) {
  return notes.map((note) => note.id);
}
