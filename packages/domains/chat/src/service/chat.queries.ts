import crypto from 'node:crypto';

import { db } from '@hominem/db';
import type { Database, Selectable } from '@hominem/db';

import type { ChatOutput } from '../contracts';
import type { CreateChatParams } from './chat.types';

type ChatRow = Selectable<Database['app.chats']>;

function toIsoString(value: Date | string | null | undefined): string {
  if (value == null) {
    return new Date().toISOString();
  }

  return value instanceof Date ? value.toISOString() : value;
}

function toChatOutput(row: ChatRow): ChatOutput {
  return {
    archivedAt: toIsoString(row.archived_at),
    id: row.id,
    title: row.title,
    userId: row.owner_userid,
    noteId: row.note_id ?? null,
    createdAt: toIsoString(row.createdat),
    updatedAt: toIsoString(row.updatedat),
  };
}

export async function createChatQuery(params: CreateChatParams): Promise<ChatOutput> {
  const now = new Date().toISOString();
  const chat = await db
    .insertInto('app.chats')
    .values({
      id: crypto.randomUUID(),
      owner_userid: params.userId,
      title: params.title,
      note_id: params.noteId ?? null,
      createdat: now,
      updatedat: now,
      ...(params.archivedAt ? { archived_at: params.archivedAt } : {}),
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return toChatOutput(chat);
}

export async function getChatByIdQuery(chatId: string, userId: string): Promise<ChatOutput | null> {
  const chat = await db
    .selectFrom('app.chats')
    .selectAll()
    .where('id', '=', chatId)
    .where('owner_userid', '=', userId)
    .executeTakeFirst();

  return chat ? toChatOutput(chat) : null;
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
  const chats = await db
    .selectFrom('app.chats')
    .selectAll()
    .where('owner_userid', '=', userId)
    .where('archived_at', 'is', null)
    .orderBy('last_message_at', 'desc')
    .limit(limit)
    .execute();

  return chats.map(toChatOutput);
}

export async function getChatByNoteIdQuery(
  noteId: string,
  userId: string,
): Promise<ChatOutput | null> {
  const chat = await db
    .selectFrom('app.chats')
    .selectAll()
    .where('note_id', '=', noteId)
    .where('owner_userid', '=', userId)
    .executeTakeFirst();

  return chat ? toChatOutput(chat) : null;
}

export async function updateChatTitleQuery(
  chatId: string,
  title: string,
  userId: string,
): Promise<ChatOutput | null> {
  const chat = await db
    .updateTable('app.chats')
    .set({
      title,
      updatedat: new Date().toISOString(),
    })
    .where('id', '=', chatId)
    .where('owner_userid', '=', userId)
    .returningAll()
    .executeTakeFirst();

  return chat ? toChatOutput(chat) : null;
}

export async function archiveChatQuery(chatId: string, userId: string): Promise<ChatOutput | null> {
  const chat = await db
    .updateTable('app.chats')
    .set({
      archived_at: new Date().toISOString(),
      updatedat: new Date().toISOString(),
    })
    .where('id', '=', chatId)
    .where('owner_userid', '=', userId)
    .returningAll()
    .executeTakeFirst();

  return chat ? toChatOutput(chat) : null;
}

export async function deleteChatQuery(chatId: string, userId: string): Promise<boolean> {
  const deleted = await db
    .deleteFrom('app.chats')
    .where('id', '=', chatId)
    .where('owner_userid', '=', userId)
    .returning('id')
    .executeTakeFirst();

  return Boolean(deleted);
}

export async function clearChatMessagesQuery(chatId: string, userId: string): Promise<boolean> {
  const existing = await getChatByIdQuery(chatId, userId);
  if (!existing) {
    return false;
  }

  await db.deleteFrom('app.chat_messages').where('chat_id', '=', chatId).execute();
  return true;
}
