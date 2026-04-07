import { ChatRepository, getDb, runInTransaction } from '@hominem/db';
import type {
  ChatRecord,
  ChatMessageRecord,
  ChatMessageFileRecord,
  NoteContext,
} from '@hominem/db';
import {
  type Chat,
  type ChatMessageDto,
  type ChatMessageFile,
  chatsSendSchema,
  type ChatsArchiveOutput,
  type ChatsCreateOutput,
  type ChatsGetMessagesOutput,
  type ChatsGetOutput,
  type ChatsListOutput,
  type ChatsSendOutput,
  type ChatsUpdateOutput,
} from '@hominem/rpc/types/chat.types';
import { zValidator } from '@hono/zod-validator';
import { generateText, type CoreMessage } from 'ai';
import { Hono } from 'hono';
import * as z from 'zod';

import { ValidationError } from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { getOpenAIAdapter } from '../utils/llm';

const chatsCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

const chatsUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

const chatsMessagesQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
});

// ─── DTO mappers (repository records → RPC wire types) ───────────────────────

function toChatDto(record: ChatRecord): Chat {
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

function toChatMessageDto(record: ChatMessageRecord): ChatMessageDto {
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

// ─── Prompt builders ─────────────────────────────────────────────────────────

function toCoreHistoryMessage(entry: ChatMessageRecord): CoreMessage | null {
  if (entry.role === 'system' || entry.role === 'user' || entry.role === 'assistant') {
    return { role: entry.role, content: entry.content };
  }
  return null;
}

function buildUserPrompt(
  message: string,
  notes: NoteContext[],
  files: ChatMessageFileRecord[],
): string {
  const sections = [message.trim()];

  if (notes.length > 0) {
    sections.push(
      [
        'Referenced notes:',
        ...notes.map((note, index) => {
          const fileText = note.files
            .flatMap((file) => {
              const snippet = file.textContent ?? file.content;
              return snippet ? [`- ${file.originalName}: ${snippet.slice(0, 1_000)}`] : [];
            })
            .join('\n');

          return [
            `${index + 1}. ${note.title ?? 'Untitled note'} (${note.id})`,
            note.content,
            ...(fileText ? ['Attached files:', fileText] : []),
          ].join('\n');
        }),
      ].join('\n\n'),
    );
  }

  if (files.length > 0) {
    sections.push(
      [
        'Attached files:',
        ...files.map((file, index) => {
          const extractedText =
            file.metadata && typeof file.metadata === 'object' && 'extractedText' in file.metadata
              ? String(file.metadata.extractedText)
              : '';
          return [
            `${index + 1}. ${file.filename ?? 'Attachment'} (${file.mimeType ?? 'application/octet-stream'})`,
            ...(extractedText ? [extractedText] : []),
          ].join('\n');
        }),
      ].join('\n\n'),
    );
  }

  return sections.filter(Boolean).join('\n\n');
}

function buildStoredUserMessageContent(
  message: string,
  notes: NoteContext[],
  files: ChatMessageFileRecord[],
): string {
  const trimmed = message.trim();
  if (trimmed.length > 0) return trimmed;
  if (files.length > 0) return files.map((f) => f.filename ?? 'Attachment').join(', ');
  if (notes.length > 0) return notes.map((n) => n.title ?? 'Untitled note').join(', ');
  throw new ValidationError('Message, notes, or files are required');
}

function getRequiredChatId(c: { req: { param: (name: string) => string | undefined } }): string {
  const chatId = c.req.param('id');
  if (!chatId) throw new ValidationError('Chat id is required');
  return chatId;
}

// ─── Per-chat routes ─────────────────────────────────────────────────────────

const chatByIdRoutes = new Hono<AppContext>()
  .get('/', async (c) => {
    const userId = c.get('userId')!;
    const chatId = getRequiredChatId(c);
    const db = getDb();

    const chat = await ChatRepository.getOwnedOrThrow(db, chatId, userId);
    const messages = await ChatRepository.getMessages(db, chatId, 100, 0);

    return c.json<ChatsGetOutput>({
      ...toChatDto(chat),
      messages: messages.map(toChatMessageDto),
    });
  })
  .delete('/', async (c) => {
    const userId = c.get('userId')!;
    const chatId = getRequiredChatId(c);
    const db = getDb();

    await ChatRepository.getOwnedOrThrow(db, chatId, userId);
    await ChatRepository.delete(db, chatId, userId);

    return c.json({ success: true });
  })
  .patch('/', zValidator('json', chatsUpdateSchema), async (c) => {
    const userId = c.get('userId')!;
    const chatId = getRequiredChatId(c);
    const { title } = c.req.valid('json');
    const db = getDb();

    await ChatRepository.getOwnedOrThrow(db, chatId, userId);
    await ChatRepository.updateTitle(db, chatId, userId, title);

    return c.json<ChatsUpdateOutput>({ success: true });
  })
  .post('/archive', async (c) => {
    const userId = c.get('userId')!;
    const chatId = getRequiredChatId(c);
    const db = getDb();

    await ChatRepository.getOwnedOrThrow(db, chatId, userId);
    const archived = await ChatRepository.archive(db, chatId, userId);

    return c.json<ChatsArchiveOutput>(toChatDto(archived));
  })
  .get('/messages', zValidator('query', chatsMessagesQuerySchema), async (c) => {
    const userId = c.get('userId')!;
    const chatId = getRequiredChatId(c);
    const db = getDb();

    await ChatRepository.getOwnedOrThrow(db, chatId, userId);
    const query = c.req.valid('query');
    const limit = query.limit ? Number.parseInt(query.limit, 10) : 100;
    const offset = query.offset ? Number.parseInt(query.offset, 10) : 0;

    const messages = await ChatRepository.getMessages(db, chatId, limit, offset);
    return c.json<ChatsGetMessagesOutput>(messages.map(toChatMessageDto));
  })
  .post('/send', zValidator('json', chatsSendSchema), async (c) => {
    const userId = c.get('userId')!;
    const chatId = getRequiredChatId(c);
    const db = getDb();

    const chat = await ChatRepository.getOwnedOrThrow(db, chatId, userId);
    const { message, fileIds = [], noteIds = [] } = c.req.valid('json');

    // Resolve context data
    const history = await ChatRepository.getMessages(db, chatId, 30, 0);
    const resolvedNotes = await ChatRepository.resolveReferencedNotes(db, userId, noteIds, message);
    const resolvedFiles = await ChatRepository.resolveChatFiles(db, userId, fileIds);

    // Build prompt and call LLM
    const prompt = buildUserPrompt(message, resolvedNotes, resolvedFiles);
    const storedUserContent = buildStoredUserMessageContent(message, resolvedNotes, resolvedFiles);

    const messages: CoreMessage[] = [
      {
        role: 'system',
        content:
          'You are a helpful assistant. Answer only with the user message, explicitly referenced notes, and attached files provided in the conversation.',
      },
      ...history.map(toCoreHistoryMessage).filter((entry): entry is CoreMessage => entry !== null),
      { role: 'user', content: prompt },
    ];

    const result = await generateText({
      model: getOpenAIAdapter(),
      messages,
    });

    // Persist messages + touch chat atomically
    const now = new Date().toISOString();
    const { userMsg, assistantMsg } = await runInTransaction(async (trx) => {
      const userMsg = await ChatRepository.insertMessage(trx, {
        chatId,
        authorUserId: userId,
        role: 'user',
        content: storedUserContent,
        files: resolvedFiles.length > 0 ? resolvedFiles : null,
        referencedNoteIds: resolvedNotes.length > 0 ? resolvedNotes.map((n) => n.id) : null,
      });

      const assistantMsg = await ChatRepository.insertMessage(trx, {
        chatId,
        authorUserId: userId,
        role: 'assistant',
        content: result.text,
      });

      await ChatRepository.touchLastMessage(trx, chatId);

      return { userMsg, assistantMsg };
    });

    // Enrich with note titles for response
    const noteTitlesById = await ChatRepository.getNoteTitles(
      db,
      resolvedNotes.map((n) => n.id),
    );

    // Map raw rows to message records for DTO conversion
    const userRecord = enrichMessageRow(userMsg, noteTitlesById);
    const assistantRecord = enrichMessageRow(assistantMsg, noteTitlesById);

    return c.json<ChatsSendOutput>({
      streamId: assistantMsg.id,
      chatId,
      chatTitle: chat.title,
      messages: {
        user: toChatMessageDto(userRecord),
        assistant: toChatMessageDto(assistantRecord),
      },
      metadata: {
        startTime: Date.now(),
        timestamp: now,
      },
    });
  });

/**
 * Convert a raw inserted message row into a ChatMessageRecord.
 */
function enrichMessageRow(
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

  const toIso = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : new Date().toISOString();

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

// ─── Top-level chat routes ───────────────────────────────────────────────────

export const chatsRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', async (c) => {
    const userId = c.get('userId')!;
    const chats = await ChatRepository.listForUser(getDb(), userId, 100);
    return c.json<ChatsListOutput>(chats.map(toChatDto));
  })
  .post('/', zValidator('json', chatsCreateSchema), async (c) => {
    const userId = c.get('userId')!;
    const { title } = c.req.valid('json');
    const chat = await ChatRepository.create(getDb(), { userId, title });
    return c.json<ChatsCreateOutput>(toChatDto(chat), 201);
  })
  .route('/:id', chatByIdRoutes);
