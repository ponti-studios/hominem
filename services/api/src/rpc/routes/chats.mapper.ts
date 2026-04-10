import type {
  ChatMessageFileRecord,
  ChatMessageRecord,
  ChatRecord,
  NoteContext,
} from '@hominem/db';
import type {
  Chat,
  ChatMessageDto,
  ChatMessageFile,
} from '@hominem/rpc/types/chat.types';

export function toChatDto(record: ChatRecord): Chat {
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

export function toChatMessageDto(record: ChatMessageRecord): ChatMessageDto {
  return {
    id: record.id,
    chatId: record.chatId,
    userId: record.userId,
    role: record.role,
    content: record.content,
    files: record.files as ChatMessageFile[] | null,
    referencedNotes: record.referencedNotes,
    toolCalls: record.toolCalls,
    reasoning: record.reasoning,
    parentMessageId: record.parentMessageId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function enrichMessageRow(
  row: {
    id: string;
    chat_id: string;
    author_userid: string | null;
    role: string;
    content: string;
    files: unknown;
    referenced_note_ids: unknown;
    tool_calls: unknown;
    reasoning: string | null;
    parent_message_id: string | null;
    createdat: unknown;
    updatedat: unknown;
  },
  noteTitlesById: Map<string, string | null>,
): ChatMessageRecord {
  const referencedNoteIds = Array.isArray(row.referenced_note_ids)
    ? (row.referenced_note_ids as string[])
    : [];

  const toIso = (value: unknown): string =>
    value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : new Date().toISOString();

  return {
    id: row.id,
    chatId: row.chat_id,
    userId: row.author_userid ?? '',
    role: row.role as ChatMessageRecord['role'],
    content: row.content,
    files: Array.isArray(row.files) ? (row.files as ChatMessageFileRecord[]) : null,
    referencedNotes:
      referencedNoteIds.length > 0
        ? referencedNoteIds.map((id) => ({ id, title: noteTitlesById.get(id) ?? null }))
        : null,
    toolCalls: Array.isArray(row.tool_calls)
      ? (row.tool_calls as ChatMessageRecord['toolCalls'])
      : null,
    reasoning: row.reasoning,
    parentMessageId: row.parent_message_id,
    createdAt: toIso(row.createdat),
    updatedAt: toIso(row.updatedat),
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
