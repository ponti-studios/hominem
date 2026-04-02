import crypto from 'node:crypto';

import { db } from '@hominem/db';
import type { Database, JsonValue as DbJsonValue, Selectable } from '@hominem/db';
import { logger } from '@hominem/utils/logger';

import type { ChatMessageInput, ChatMessageOutput, ChatMessageRole } from '../contracts';
import { ChatError } from './chat.types';

type ChatMessageRow = Selectable<Database['app.chat_messages']>;
type ChatMessageRowLike = ChatMessageRow & {
  user_id?: string | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
};

export type CreateMessageParams = {
  chatId: ChatMessageOutput['chatId'];
  userId: ChatMessageOutput['userId'];
  role: ChatMessageOutput['role'];
  content: ChatMessageOutput['content'];
  files?: ChatMessageOutput['files'];
  toolCalls?: ChatMessageOutput['toolCalls'];
  reasoning?: string;
  parentMessageId?: string | null;
};

export interface ChatMessagesOptions {
  limit?: number | undefined;
  offset?: number | undefined;
  orderBy?: 'asc' | 'desc' | undefined;
}

function toIsoString(value: string | Date | null | undefined): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(0).toISOString();
}

function toNullableParentMessageId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toDbJsonValue(value: unknown): DbJsonValue | null {
  if (value == null) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as DbJsonValue;
}

function toMessageOutput(row: ChatMessageRowLike): ChatMessageOutput {
  return {
    id: row.id,
    chatId: row.chat_id,
    userId: row.author_userid ?? row.user_id ?? '',
    role: row.role as ChatMessageRole,
    content: row.content,
    files: (Array.isArray(row.files) ? row.files : null) as ChatMessageOutput['files'],
    toolCalls: (Array.isArray(row.tool_calls)
      ? row.tool_calls
      : null) as ChatMessageOutput['toolCalls'],
    reasoning: row.reasoning ?? null,
    parentMessageId: row.parent_message_id,
    createdAt: toIsoString(row.createdat ?? row.created_at),
    updatedAt: toIsoString(row.updatedat ?? row.updated_at),
  };
}

export class MessageService {
  async addMessage(params: CreateMessageParams): Promise<ChatMessageOutput | null> {
    const messages = await this.addMessages([params]);
    return messages[0] ?? null;
  }

  async addMessages(params: CreateMessageParams[]): Promise<ChatMessageOutput[]> {
    if (params.length === 0) {
      return [];
    }

    const chatId = params[0]?.chatId;
    if (!chatId || params.some((message) => message.chatId !== chatId)) {
      throw new ChatError('VALIDATION_ERROR', 'Messages must target the same chat');
    }

    try {
      const inserted = await db
        .insertInto('app.chat_messages')
        .values(
          params.map((message) => ({
            id: crypto.randomUUID(),
            chat_id: message.chatId,
            author_userid: message.userId,
            role: message.role,
            content: message.content,
            files: toDbJsonValue(message.files),
            tool_calls: toDbJsonValue(message.toolCalls),
            reasoning: message.reasoning ?? null,
            parent_message_id: toNullableParentMessageId(message.parentMessageId),
          })),
        )
        .returningAll()
        .execute();

      return inserted.map(toMessageOutput);
    } catch (error) {
      logger.error('Failed to add chat messages', { error, chatId });
      throw new ChatError('DATABASE_ERROR', 'Failed to add chat messages');
    }
  }

  async getChatMessages(
    chatId: string,
    options: ChatMessagesOptions = { limit: 10, offset: 0, orderBy: 'asc' },
  ): Promise<ChatMessageOutput[]> {
    try {
      const messages = await db
        .selectFrom('app.chat_messages')
        .selectAll()
        .where('chat_id', '=', chatId)
        .limit(options.limit ?? 50)
        .offset(options.offset ?? 0)
        .orderBy('createdat', options.orderBy === 'desc' ? 'desc' : 'asc')
        .execute();

      return messages.map(toMessageOutput);
    } catch (error) {
      logger.error('Failed to get chat messages', { error, chatId });
      throw new ChatError('DATABASE_ERROR', 'Failed to get chat messages');
    }
  }

  async getMessageById(messageId: string, userId: string): Promise<ChatMessageOutput | null> {
    const message = await db
      .selectFrom('app.chat_messages as message')
      .innerJoin('app.chats as chat', 'chat.id', 'message.chat_id')
      .selectAll('message')
      .where('message.id', '=', messageId)
      .where('chat.owner_userid', '=', userId)
      .executeTakeFirst();

    return message ? toMessageOutput(message as ChatMessageRow) : null;
  }

  async updateMessage({
    messageId,
    content,
    toolCalls,
  }: {
    messageId: string;
    content: string;
    toolCalls?: ChatMessageInput['toolCalls'];
  }): Promise<ChatMessageOutput | null> {
    const message = await db
      .updateTable('app.chat_messages')
      .set({
        content,
        tool_calls: toDbJsonValue(toolCalls),
        updatedat: new Date().toISOString(),
      })
      .where('id', '=', messageId)
      .returningAll()
      .executeTakeFirst();

    return message ? toMessageOutput(message) : null;
  }

  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    const message = await db
      .selectFrom('app.chat_messages as message')
      .innerJoin('app.chats as chat', 'chat.id', 'message.chat_id')
      .select('message.id')
      .where('message.id', '=', messageId)
      .where('chat.owner_userid', '=', userId)
      .executeTakeFirst();

    if (!message) {
      return false;
    }

    await db.deleteFrom('app.chat_messages').where('id', '=', messageId).execute();
    return true;
  }

  async deleteMessagesAfter(
    chatId: string,
    afterTimestamp: string,
    userId: string,
  ): Promise<number> {
    const existing = await db
      .selectFrom('app.chats')
      .select('id')
      .where('id', '=', chatId)
      .where('owner_userid', '=', userId)
      .executeTakeFirst();

    if (!existing) {
      throw new ChatError('AUTH_ERROR', 'Chat not found or access denied');
    }

    const deleted = await db
      .deleteFrom('app.chat_messages')
      .where('chat_id', '=', chatId)
      .where('createdat', '>', new Date(afterTimestamp))
      .returning('id')
      .execute();

    return deleted.length;
  }
}
