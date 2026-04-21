/**
 * Chat queries — now delegates to ChatRepository.
 *
 * This module maintains the existing function signatures for ChatService
 * compatibility but uses the centralized repository instead of raw Kysely.
 */

import { ChatRepository, getDb } from '@hakumi/db';

import type { ChatOutput } from '../chat.types';
import type { CreateChatParams } from './chat.service.types';
function toChatOutput(record: {
  archivedAt: ChatOutput['archivedAt'];
  id: string;
  title: string;
  userId: string;
  noteId: string | null;
  createdAt: ChatOutput['createdAt'];
  updatedAt: ChatOutput['updatedAt'];
}): ChatOutput {
  return {
    archivedAt: record.archivedAt,
    id: record.id,
    title: record.title,
    userId: record.userId,
    noteId: record.noteId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function createChatQuery(params: CreateChatParams): Promise<ChatOutput> {
  const record = await ChatRepository.create(getDb(), {
    userId: params.userId,
    title: params.title,
    noteId: params.noteId ?? null,
    archivedAt: params.archivedAt ?? null,
  });

  return toChatOutput(record);
}

export async function getChatByIdQuery(chatId: string, userId: string): Promise<ChatOutput | null> {
  try {
    const record = await ChatRepository.getOwnedOrThrow(getDb(), chatId, userId);
    return toChatOutput(record);
  } catch {
    return null;
  }
}

export async function getOrCreateActiveChatQuery(
  userId: string,
  chatId?: string,
): Promise<ChatOutput> {
  if (chatId) {
    const existing = await getChatByIdQuery(chatId, userId);
    if (existing) {
      return existing;
    }
  }

  return createChatQuery({ title: 'New Chat', userId });
}

export async function getUserChatsQuery(userId: string, limit = 50): Promise<ChatOutput[]> {
  const records = await ChatRepository.listForUser(getDb(), userId, limit);
  return records.map(toChatOutput);
}

export async function getChatByNoteIdQuery(
  noteId: string,
  userId: string,
): Promise<ChatOutput | null> {
  const record = await ChatRepository.getByNoteId(getDb(), noteId, userId);
  if (!record) return null;

  return toChatOutput(record);
}

export async function updateChatTitleQuery(
  chatId: string,
  title: string,
  userId: string,
): Promise<ChatOutput | null> {
  try {
    await ChatRepository.updateTitle(getDb(), chatId, userId, title);
    return getChatByIdQuery(chatId, userId);
  } catch {
    return null;
  }
}

export async function archiveChatQuery(chatId: string, userId: string): Promise<ChatOutput | null> {
  try {
    const record = await ChatRepository.archive(getDb(), chatId, userId);
    return toChatOutput(record);
  } catch {
    return null;
  }
}

export async function deleteChatQuery(chatId: string, userId: string): Promise<boolean> {
  try {
    await ChatRepository.getOwnedOrThrow(getDb(), chatId, userId);
    await ChatRepository.delete(getDb(), chatId, userId);
    return true;
  } catch {
    return false;
  }
}

export async function clearChatMessagesQuery(chatId: string, userId: string): Promise<boolean> {
  return ChatRepository.clearMessages(getDb(), chatId, userId);
}
