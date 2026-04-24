import type {
  ChatMessageFileRecord,
  ChatMessageRecord,
  ChatRecord,
  NoteContext,
} from '@hominem/db';

export function toChatDto(record: ChatRecord) {
  return {
    id: record.id,
    userId: record.userId,
    title: record.title,
    noteId: record.noteId,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toChatMessageDto(record: ChatMessageRecord) {
  return {
    id: record.id,
    chatId: record.chatId,
    userId: record.userId,
    role: record.role,
    content: record.content,
    files: record.files as Array<{ type: 'image' | 'file'; fileId?: string; url?: string; filename?: string; mimeType?: string; size?: number; metadata?: Record<string, unknown> }> | null,
    referencedNotes: record.referencedNotes,
    toolCalls: record.toolCalls,
    reasoning: record.reasoning,
    parentMessageId: record.parentMessageId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toStoredUserMessageContent(
  message: string,
  notes: NoteContext[],
  files: ChatMessageFileRecord[],
): string {
  const trimmed = message.trim();
  if (trimmed.length > 0) return trimmed;
  if (files.length > 0) return files.map((file) => file.filename ?? 'Attachment').join(', ');
  if (notes.length > 0) return notes.map((note) => note.title ?? 'Untitled note').join(', ');
  return '';
}
