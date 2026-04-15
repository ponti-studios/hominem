import type { ChatMessageItem } from './chat.types';

export function getReferencedNoteLabel(
  note: NonNullable<ChatMessageItem['referencedNotes']>[number],
) {
  return note.title || note.id;
}
