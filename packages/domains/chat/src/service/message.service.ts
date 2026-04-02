import crypto from 'node:crypto';

import { db } from '@hominem/db';
import type { Database } from '@hominem/db';
import type { Selectable } from 'kysely';

import type { ChatMessageInput, ChatMessageOutput, ChatMessageRole } from '../contracts';
import { ChatError } from './chat.types';

type ChatMessageRow = Selectable<Database['app.chat_messages']>;

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

function toMessageOutput(row: ChatMessageRow): ChatMessageOutput {
  return {
    id: row.id,
    chatId: row.chat_id,
    userId: row.author_userid ?? '',
    role: row.role as ChatMessageRole,
    content: row.content,
    files: (Array.isArray(row.files) ? row.files : null) as ChatMessageOutput['files'],
    toolCalls: (Array.isArray(row.tool_calls)
      ? row.tool_calls
      : null) as ChatMessageOutput['toolCalls'],
    reasoning: row.reasoning ?? null,
    parentMessageId: row.parent_message_id,
    createdAt: toIsoString(row.createdat),
    updatedAt: toIsoString(row.updatedat),
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

    const inserted = await db
      .insertInto('app.chat_messages')
      .values(
        params.map((message) => ({
          id: crypto.randomUUID(),
          chat_id: message.chatId,
          author_userid: message.userId,
          role: message.role,
          content: message.content,
          files: message.files ?? null,
          tool_calls: message.toolCalls ?? null,
          reasoning: message.reasoning ?? null,
          parent_message_id: message.parentMessageId ?? null,
        })),
      )
      .returningAll()
      .execute();

    return inserted.map(toMessageOutput);
  }

  async getChatMessages(
    chatId: string,
    options: ChatMessagesOptions = { limit: 10, offset: 0, orderBy: 'asc' },
  ): Promise<ChatMessageOutput[]> {
    const messages = await db
      .selectFrom('app.chat_messages')
      .selectAll()
      .where('chat_id', '=', chatId)
      .limit(options.limit ?? 50)
      .offset(options.offset ?? 0)
      .orderBy('createdat', options.orderBy === 'desc' ? 'desc' : 'asc')
      .execute();

    return messages.map(toMessageOutput);
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
        tool_calls: toolCalls ?? null,
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
      .where('createdat', '>', afterTimestamp)
      .returning('id')
      .execute();

    return deleted.length;
  }
}
