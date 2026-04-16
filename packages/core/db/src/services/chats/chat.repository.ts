import type { Selectable } from 'kysely';

import { NotFoundError, ValidationError } from '../../errors';
import {
  parseChatMessageFiles,
  parseChatMessageToolCalls,
  type ChatMessageFileRecord,
  type ChatMessageToolCallRecord,
} from '../../guards';
import type { DbHandle } from '../../transaction';
import type { AppChatMessages, AppChats } from '../../types/database';
import { toIsoString, toRequiredIsoString } from '../_shared/mappers';

export type { ChatMessageFileRecord, ChatMessageToolCallRecord } from '../../guards';

type ChatRow = Selectable<AppChats>;
type ChatMessageRow = Selectable<AppChatMessages>;

export interface ChatRecord {
  id: string;
  userId: string;
  title: string;
  noteId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ChatMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ReferencedNoteRecord {
  id: string;
  title: string | null;
}

export interface ChatMessageRecord {
  id: string;
  chatId: string;
  userId: string;
  role: ChatMessageRole;
  content: string;
  files: ChatMessageFileRecord[] | null;
  referencedNotes: ReferencedNoteRecord[] | null;
  toolCalls: ChatMessageToolCallRecord[] | null;
  reasoning: string | null;
  parentMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InsertChatMessageInput {
  chatId: string;
  authorUserId: string;
  role: ChatMessageRole;
  content: string;
  files?: unknown[] | null;
  referencedNoteIds?: string[] | null;
  reasoning?: string | null;
  toolCalls?: unknown[] | null;
  parentMessageId?: string | null;
}

function toChatRecord(row: ChatRow): ChatRecord {
  return {
    id: row.id,
    userId: row.owner_userid,
    title: row.title,
    noteId: row.note_id ?? null,
    archivedAt: toIsoString(row.archived_at),
    createdAt: toRequiredIsoString(row.createdat),
    updatedAt: toRequiredIsoString(row.updatedat),
  };
}

function toChatMessageRecord(
  row: ChatMessageRow,
  noteTitlesById: Map<string, string | null>,
): ChatMessageRecord {
  const referencedNoteIds = Array.isArray(row.referenced_note_ids)
    ? (row.referenced_note_ids as string[])
    : [];

  return {
    id: row.id,
    chatId: row.chat_id,
    userId: row.author_userid ?? '',
    role: row.role as ChatMessageRole,
    content: row.content,
    files: parseChatMessageFiles(row.files),
    referencedNotes:
      referencedNoteIds.length > 0
        ? referencedNoteIds.map((id) => ({
            id,
            title: noteTitlesById.get(id) ?? null,
          }))
        : null,
    toolCalls: parseChatMessageToolCalls(row.tool_calls),
    reasoning: row.reasoning ?? null,
    parentMessageId: row.parent_message_id,
    createdAt: toRequiredIsoString(row.createdat),
    updatedAt: toRequiredIsoString(row.updatedat),
  };
}

function toJsonColumnValue(value: unknown[] | null | undefined): string | null {
  return value ? JSON.stringify(value) : null;
}

export const ChatRepository = {
  /**
   * Get a chat by ID with ownership enforcement. Throws if not found.
   */
  async getOwnedOrThrow(handle: DbHandle, chatId: string, userId: string): Promise<ChatRecord> {
    const chat = await handle
      .selectFrom('app.chats')
      .selectAll()
      .where('id', '=', chatId)
      .where('owner_userid', '=', userId)
      .executeTakeFirst();

    if (!chat) {
      throw new NotFoundError('Chat', { chatId });
    }

    return toChatRecord(chat as ChatRow);
  },

  /**
   * Get a chat by note ID with ownership enforcement.
   */
  async getByNoteId(handle: DbHandle, noteId: string, userId: string): Promise<ChatRecord | null> {
    const chat = await handle
      .selectFrom('app.chats')
      .selectAll()
      .where('note_id', '=', noteId)
      .where('owner_userid', '=', userId)
      .executeTakeFirst();

    return chat ? toChatRecord(chat as ChatRow) : null;
  },

  /**
   * List non-archived chats for a user, ordered by last message.
   */
  async listForUser(handle: DbHandle, userId: string, limit = 100): Promise<ChatRecord[]> {
    const chats = (await handle
      .selectFrom('app.chats')
      .selectAll()
      .where('owner_userid', '=', userId)
      .where('archived_at', 'is', null)
      .orderBy('last_message_at', 'desc')
      .limit(limit)
      .execute()) as ChatRow[];

    return chats.map(toChatRecord);
  },

  /**
   * Create a new chat.
   */
  async create(
    handle: DbHandle,
    input: { userId: string; title: string; noteId?: string | null; archivedAt?: string | null },
  ): Promise<ChatRecord> {
    const chat = await handle
      .insertInto('app.chats')
      .values({
        owner_userid: input.userId,
        title: input.title,
        note_id: input.noteId ?? null,
        archived_at: input.archivedAt ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toChatRecord(chat as ChatRow);
  },

  /**
   * Update a chat's title.
   */
  async updateTitle(
    handle: DbHandle,
    chatId: string,
    userId: string,
    title: string,
  ): Promise<void> {
    await handle
      .updateTable('app.chats')
      .set({ title, updatedat: new Date().toISOString() })
      .where('id', '=', chatId)
      .where('owner_userid', '=', userId)
      .executeTakeFirstOrThrow();
  },

  /**
   * Archive a chat.
   */
  async archive(handle: DbHandle, chatId: string, userId: string): Promise<ChatRecord> {
    const archived = await handle
      .updateTable('app.chats')
      .set({
        archived_at: new Date().toISOString(),
        updatedat: new Date().toISOString(),
      })
      .where('id', '=', chatId)
      .where('owner_userid', '=', userId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return toChatRecord(archived as ChatRow);
  },

  /**
   * Delete a chat by ID with ownership enforcement.
   */
  async delete(handle: DbHandle, chatId: string, userId: string): Promise<void> {
    await handle
      .deleteFrom('app.chats')
      .where('id', '=', chatId)
      .where('owner_userid', '=', userId)
      .execute();
  },

  /**
   * Delete all messages for a chat after checking ownership.
   */
  async clearMessages(handle: DbHandle, chatId: string, userId: string): Promise<boolean> {
    const existing = await handle
      .selectFrom('app.chats')
      .select('id')
      .where('id', '=', chatId)
      .where('owner_userid', '=', userId)
      .executeTakeFirst();

    if (!existing) {
      return false;
    }

    await handle.deleteFrom('app.chat_messages').where('chat_id', '=', chatId).execute();
    return true;
  },

  /**
   * Touch last_message_at after sending messages.
   */
  async touchLastMessage(handle: DbHandle, chatId: string): Promise<void> {
    await handle
      .updateTable('app.chats')
      .set({ last_message_at: new Date().toISOString() })
      .where('id', '=', chatId)
      .execute();
  },

  /**
   * Fetch note titles for referenced note IDs (for message enrichment).
   */
  async getNoteTitles(handle: DbHandle, noteIds: string[]): Promise<Map<string, string | null>> {
    if (noteIds.length === 0) {
      return new Map();
    }
    const notes = (await handle
      .selectFrom('app.notes')
      .select(['id', 'title'])
      .where('id', 'in', noteIds)
      .execute()) as Array<{ id: string; title: string | null }>;

    return new Map(notes.map((note) => [note.id, note.title]));
  },

  /**
   * Get messages for a chat, enriched with referenced note titles.
   */
  async getMessages(
    handle: DbHandle,
    chatId: string,
    limit = 100,
    offset = 0,
  ): Promise<ChatMessageRecord[]> {
    const messages = (await handle
      .selectFrom('app.chat_messages')
      .selectAll()
      .where('chat_id', '=', chatId)
      .orderBy('createdat', 'asc')
      .limit(limit)
      .offset(offset)
      .execute()) as ChatMessageRow[];

    const noteIds = [
      ...new Set(
        messages.flatMap((m) =>
          Array.isArray(m.referenced_note_ids) ? (m.referenced_note_ids as string[]) : [],
        ),
      ),
    ];
    const noteTitlesById = await ChatRepository.getNoteTitles(handle, noteIds);

    return messages.map((m) => toChatMessageRecord(m, noteTitlesById));
  },

  /**
   * Insert a single message. Returns the raw row for transaction composition.
   */
  async insertMessage(handle: DbHandle, input: InsertChatMessageInput): Promise<ChatMessageRow> {
    return (await handle
      .insertInto('app.chat_messages')
      .values({
        chat_id: input.chatId,
        author_userid: input.authorUserId,
        role: input.role,
        content: input.content,
        files: toJsonColumnValue(input.files as unknown[] | null),
        referenced_note_ids: toJsonColumnValue(input.referencedNoteIds),
        reasoning: input.reasoning ?? null,
        tool_calls: toJsonColumnValue(input.toolCalls as unknown[] | null),
        parent_message_id: input.parentMessageId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow()) as ChatMessageRow;
  },

  /**
   * Resolve note context for referenced notes (by explicit IDs and #mention slugs).
   */
  async resolveReferencedNotes(
    handle: DbHandle,
    userId: string,
    explicitNoteIds: string[],
    message: string,
  ): Promise<NoteContext[]> {
    const mentionedSlugs = extractMentionSlugs(message);
    const explicitIds = [...new Set(explicitNoteIds)];

    type NoteInfo = { id: string; title: string | null; content: string; excerpt: string | null };

    const explicitNotes: NoteInfo[] =
      explicitIds.length > 0
        ? ((await handle
            .selectFrom('app.notes')
            .select(['id', 'title', 'content', 'excerpt'])
            .where('owner_userid', '=', userId)
            .where('id', 'in', explicitIds)
            .execute()) as NoteInfo[])
        : [];

    if (explicitNotes.length !== explicitIds.length) {
      throw new ValidationError('One or more referenced notes are unavailable');
    }

    const candidateNotes: NoteInfo[] =
      mentionedSlugs.length > 0
        ? ((await handle
            .selectFrom('app.notes')
            .select(['id', 'title', 'content', 'excerpt'])
            .where('owner_userid', '=', userId)
            .execute()) as NoteInfo[])
        : [];

    const matchedMentionNotes = candidateNotes.filter((note) => {
      const slug = slugifyNoteTitle(note.title);
      return slug ? mentionedSlugs.includes(slug) : false;
    });

    const mergedNotes = [...explicitNotes, ...matchedMentionNotes].reduce<Map<string, NoteContext>>(
      (acc, note) => {
        acc.set(note.id, {
          id: note.id,
          title: note.title,
          content: note.content,
          excerpt: note.excerpt,
          files: [],
        });
        return acc;
      },
      new Map(),
    );

    const noteIds = [...mergedNotes.keys()];
    if (noteIds.length === 0) {
      return [];
    }

    const files = (await handle
      .selectFrom('app.note_files as noteFile')
      .innerJoin('app.files as file', 'file.id', 'noteFile.file_id')
      .select([
        'noteFile.note_id as noteId',
        'file.id',
        'file.original_name',
        'file.content',
        'file.text_content',
      ])
      .where('noteFile.note_id', 'in', noteIds)
      .execute()) as Array<{
      noteId: string;
      id: string;
      original_name: string;
      content: string | null;
      text_content: string | null;
    }>;

    for (const file of files) {
      const note = mergedNotes.get(file.noteId);
      if (!note) continue;
      note.files.push({
        id: file.id,
        originalName: file.original_name,
        content: file.content,
        textContent: file.text_content,
      });
    }

    return [...mergedNotes.values()];
  },

  /**
   * Resolve chat file attachments by file IDs with ownership check.
   */
  async resolveChatFiles(
    handle: DbHandle,
    userId: string,
    fileIds: string[],
  ): Promise<ChatMessageFileRecord[]> {
    if (fileIds.length === 0) {
      return [];
    }

    const uniqueIds = [...new Set(fileIds)];
    const files = (await handle
      .selectFrom('app.files')
      .selectAll()
      .where('owner_userid', '=', userId)
      .where('id', 'in', uniqueIds)
      .execute()) as Array<{
      id: string;
      mimetype: string;
      original_name: string;
      size: number;
      text_content: string | null;
      url: string;
    }>;

    if (files.length !== uniqueIds.length) {
      throw new ValidationError('One or more uploaded files are unavailable');
    }

    return files.map(
      (file): ChatMessageFileRecord => ({
        type: file.mimetype.startsWith('image/') ? 'image' : 'file',
        fileId: file.id,
        url: file.url,
        filename: file.original_name,
        mimeType: file.mimetype,
        size: file.size,
        ...(file.text_content
          ? { metadata: { extractedText: file.text_content.slice(0, 4_000) } }
          : {}),
      }),
    );
  },
};

export interface NoteContext {
  id: string;
  title: string | null;
  content: string;
  excerpt: string | null;
  files: Array<{
    id: string;
    originalName: string;
    content: string | null;
    textContent: string | null;
  }>;
}

function slugifyNoteTitle(title: string | null): string | null {
  const normalized = (title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : null;
}

function extractMentionSlugs(message: string): string[] {
  return [...message.matchAll(/#([a-zA-Z0-9][\w-]*)/g)].map((match) => match[1]!.toLowerCase());
}
