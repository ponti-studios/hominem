import type { ChatMessageSnapshot, ChatSnapshot } from '@hominem/chat';
import type { ChatSourceRecord } from '@hominem/db/chats';

import { signFileUrl } from './file-urls';

export function toChatDto(record: ChatSnapshot) {
  return {
    id: record.id,
    userId: record.userId,
    title: record.title,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

// Swaps each attachment's persisted URL for a short-lived signed one.
export async function signMessageFiles(record: ChatMessageSnapshot): Promise<ChatMessageSnapshot> {
  if (!record.files) return record;
  const files = await Promise.all(
    record.files.map(async (file) => ({
      ...file,
      ...(file.url
        ? {
            url: await signFileUrl(file.url, {
              mimetype: file.mimeType,
              originalName: file.filename,
            }),
          }
        : {}),
    })),
  );
  return { ...record, files };
}

export async function toChatMessageDto(record: ChatMessageSnapshot) {
  const { files } = await signMessageFiles(record);
  return {
    id: record.id,
    chatId: record.chatId,
    userId: record.userId,
    role: record.role,
    content: record.content,
    files,
    toolCalls: record.toolCalls,
    reasoning: record.reasoning,
    parentMessageId: record.parentMessageId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toChatSourceDto(record: ChatSourceRecord) {
  return {
    id: record.id,
    chatId: record.chatId,
    noteId: record.noteId,
    title: record.title,
    addedByUserId: record.addedByUserId,
    createdAt: record.createdAt,
  };
}
