import { db, sql } from '@hominem/db';
import {
  type Chat,
  type ChatMessage,
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

import { NotFoundError, ValidationError } from '../errors';
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

type ChatRow = {
  archived_at: Date | string | null;
  createdat: Date | string;
  id: string;
  note_id: string | null;
  owner_userid: string;
  title: string;
  updatedat: Date | string;
};

type ChatMessageRow = {
  author_userid: string | null;
  chat_id: string;
  content: string;
  createdat: Date | string;
  files: unknown;
  id: string;
  parent_message_id: string | null;
  referenced_note_ids: unknown;
  reasoning: string | null;
  role: ChatMessage['role'];
  tool_calls: unknown;
  updatedat: Date | string;
};

type NoteContext = {
  content: string;
  excerpt: string | null;
  files: Array<{
    content: string | null;
    id: string;
    originalName: string;
    textContent: string | null;
  }>;
  id: string;
  title: string | null;
};

function toJsonColumnValue(value: unknown[] | null): string | null {
  return value ? JSON.stringify(value) : null;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

function toChat(row: ChatRow): Chat {
  return {
    archivedAt: toIsoString(row.archived_at),
    id: row.id,
    userId: row.owner_userid,
    title: row.title,
    noteId: row.note_id,
    createdAt: toIsoString(row.createdat) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updatedat) ?? new Date().toISOString(),
  };
}

function toChatMessage(
  row: ChatMessageRow,
  noteTitlesById: Map<string, string | null>,
): ChatMessage {
  const referencedNoteIds = Array.isArray(row.referenced_note_ids)
    ? (row.referenced_note_ids as string[])
    : [];

  return {
    id: row.id,
    chatId: row.chat_id,
    userId: row.author_userid ?? '',
    role: row.role,
    content: row.content,
    files: Array.isArray(row.files) ? (row.files as ChatMessageFile[]) : null,
    referencedNotes:
      referencedNoteIds.length > 0
        ? referencedNoteIds.map((id) => ({
            id,
            title: noteTitlesById.get(id) ?? null,
          }))
        : null,
    toolCalls: Array.isArray(row.tool_calls) ? (row.tool_calls as ChatMessage['toolCalls']) : null,
    reasoning: row.reasoning,
    parentMessageId: row.parent_message_id,
    createdAt: toIsoString(row.createdat) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updatedat) ?? new Date().toISOString(),
  };
}

async function getChat(chatId: string, userId: string) {
  const chat = await db
    .selectFrom('app.chats')
    .selectAll()
    .where('id', '=', chatId)
    .where('owner_userid', '=', userId)
    .executeTakeFirst();

  if (!chat) {
    throw new NotFoundError('Chat');
  }

  return chat as ChatRow;
}

async function getNoteTitles(noteIds: string[]): Promise<Map<string, string | null>> {
  if (noteIds.length === 0) {
    return new Map();
  }

  const notes = (await db
    .selectFrom('app.notes')
    .select(['id', 'title'])
    .where('id', 'in', noteIds)
    .execute()) as Array<{ id: string; title: string | null }>;

  return new Map(notes.map((note) => [note.id, note.title]));
}

async function getChatMessages(chatId: string, limit?: number, offset?: number) {
  const messages = (await db
    .selectFrom('app.chat_messages')
    .selectAll()
    .where('chat_id', '=', chatId)
    .orderBy('createdat', 'asc')
    .limit(limit ?? 100)
    .offset(offset ?? 0)
    .execute()) as ChatMessageRow[];

  const noteIds = [
    ...new Set(
      messages.flatMap((message) =>
        Array.isArray(message.referenced_note_ids) ? message.referenced_note_ids : [],
      ),
    ),
  ] as string[];
  const noteTitlesById = await getNoteTitles(noteIds);

  return messages.map((message) => toChatMessage(message, noteTitlesById));
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

async function resolveReferencedNotes(userId: string, explicitNoteIds: string[], message: string) {
  const mentionedSlugs = extractMentionSlugs(message);
  const explicitIds = [...new Set(explicitNoteIds)];

  const explicitNotes = (
    explicitIds.length > 0
      ? await db
          .selectFrom('app.notes')
          .select(['id', 'title', 'content', 'excerpt'])
          .where('owner_userid', '=', userId)
          .where('id', 'in', explicitIds)
          .execute()
      : []
  ) as Array<{ id: string; title: string | null; content: string; excerpt: string | null }>;

  if (explicitNotes.length !== explicitIds.length) {
    throw new ValidationError('One or more referenced notes are unavailable');
  }

  const candidateNotes = (
    mentionedSlugs.length > 0
      ? await db
          .selectFrom('app.notes')
          .select(['id', 'title', 'content', 'excerpt'])
          .where('owner_userid', '=', userId)
          .execute()
      : []
  ) as Array<{ id: string; title: string | null; content: string; excerpt: string | null }>;

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

  const files = (await db
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
    if (!note) {
      continue;
    }
    note.files.push({
      id: file.id,
      originalName: file.original_name,
      content: file.content,
      textContent: file.text_content,
    });
  }

  return [...mergedNotes.values()];
}

async function resolveChatFiles(userId: string, fileIds: string[]): Promise<ChatMessageFile[]> {
  if (fileIds.length === 0) {
    return [];
  }

  const files = (await db
    .selectFrom('app.files')
    .selectAll()
    .where('owner_userid', '=', userId)
    .where('id', 'in', [...new Set(fileIds)])
    .execute()) as Array<{
    id: string;
    mimetype: string;
    original_name: string;
    size: number;
    text_content: string | null;
    url: string;
  }>;

  if (files.length !== [...new Set(fileIds)].length) {
    throw new ValidationError('One or more uploaded files are unavailable');
  }

  return files.map((file): ChatMessageFile => ({
    type: file.mimetype.startsWith('image/') ? 'image' : 'file',
    fileId: file.id,
    url: file.url,
    filename: file.original_name,
    mimeType: file.mimetype,
    size: file.size,
    ...(file.text_content
      ? { metadata: { extractedText: file.text_content.slice(0, 4_000) } }
      : {}),
  }));
}

function getRequiredChatId(c: { req: { param: (name: string) => string | undefined } }): string {
  const chatId = c.req.param('id');
  if (!chatId) {
    throw new ValidationError('Chat id is required');
  }
  return chatId;
}

function toCoreHistoryMessage(entry: ChatMessage): CoreMessage | null {
  if (entry.role === 'system' || entry.role === 'user' || entry.role === 'assistant') {
    return {
      role: entry.role,
      content: entry.content,
    };
  }

  return null;
}

function buildUserPrompt(message: string, notes: NoteContext[], files: ChatMessageFile[]) {
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
  files: ChatMessageFile[],
) {
  const trimmed = message.trim();

  if (trimmed.length > 0) {
    return trimmed;
  }

  if (files.length > 0) {
    return files.map((file) => file.filename ?? 'Attachment').join(', ');
  }

  if (notes.length > 0) {
    return notes.map((note) => note.title ?? 'Untitled note').join(', ');
  }

  throw new ValidationError('Message, notes, or files are required');
}

const chatByIdRoutes = new Hono<AppContext>()
  .get('/', async (c) => {
    const userId = c.get('userId')!;
    const chatId = getRequiredChatId(c);
    const chat = toChat(await getChat(chatId, userId));
    const messages = await getChatMessages(chatId, 100, 0);
    return c.json<ChatsGetOutput>({ ...chat, messages });
  })
  .delete('/', async (c) => {
    const userId = c.get('userId')!;
    const chatId = getRequiredChatId(c);
    await getChat(chatId, userId);
    await db
      .deleteFrom('app.chats')
      .where('id', '=', chatId)
      .where('owner_userid', '=', userId)
      .execute();
    return c.json({ success: true });
  })
  .patch('/', zValidator('json', chatsUpdateSchema), async (c) => {
    const userId = c.get('userId')!;
    const chatId = getRequiredChatId(c);
    const { title } = c.req.valid('json');
    await getChat(chatId, userId);
    await db
      .updateTable('app.chats')
      .set({ title, updatedat: new Date().toISOString() })
      .where('id', '=', chatId)
      .where('owner_userid', '=', userId)
      .executeTakeFirstOrThrow();
    return c.json<ChatsUpdateOutput>({ success: true });
  })
  .post('/archive', async (c) => {
    const userId = c.get('userId')!;
    const chatId = getRequiredChatId(c);
    await getChat(chatId, userId);
    const archived = await db
      .updateTable('app.chats')
      .set({
        archived_at: new Date().toISOString(),
        updatedat: new Date().toISOString(),
      })
      .where('id', '=', chatId)
      .where('owner_userid', '=', userId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return c.json<ChatsArchiveOutput>(toChat(archived as ChatRow));
  })
  .get('/messages', zValidator('query', chatsMessagesQuerySchema), async (c) => {
    const userId = c.get('userId')!;
    const chatId = getRequiredChatId(c);
    await getChat(chatId, userId);
    const query = c.req.valid('query');
    const limit = query.limit ? Number.parseInt(query.limit, 10) : 100;
    const offset = query.offset ? Number.parseInt(query.offset, 10) : 0;
    return c.json<ChatsGetMessagesOutput>(await getChatMessages(chatId, limit, offset));
  })
  .post('/send', zValidator('json', chatsSendSchema), async (c) => {
    const userId = c.get('userId')!;
    const chatId = getRequiredChatId(c);
    const chat = await getChat(chatId, userId);
    const { message, fileIds = [], noteIds = [] } = c.req.valid('json');

    const history = await getChatMessages(chatId, 30, 0);
    const resolvedNotes = await resolveReferencedNotes(userId, noteIds, message);
    const resolvedFiles = await resolveChatFiles(userId, fileIds);
    const prompt = buildUserPrompt(message, resolvedNotes, resolvedFiles);
    const storedUserContent = buildStoredUserMessageContent(message, resolvedNotes, resolvedFiles);

    const messages: CoreMessage[] = [
      {
        role: 'system',
        content:
          'You are a helpful assistant. Answer only with the user message, explicitly referenced notes, and attached files provided in the conversation.',
      },
      ...history.map(toCoreHistoryMessage).filter((entry): entry is CoreMessage => entry !== null),
      {
        role: 'user',
        content: prompt,
      },
    ];

    const result = await generateText({
      model: getOpenAIAdapter(),
      messages,
    });

    const now = new Date().toISOString();
    const [userMessage, assistantMessage] = await db
      .transaction()
      .execute(async (trx: any) => {
        const insertedUser = await trx
          .insertInto('app.chat_messages')
          .values({
            chat_id: chatId,
            author_userid: userId,
            role: 'user',
            content: storedUserContent,
            files: toJsonColumnValue(resolvedFiles.length > 0 ? resolvedFiles : null),
            referenced_note_ids: toJsonColumnValue(
              resolvedNotes.length > 0 ? resolvedNotes.map((note) => note.id) : null,
            ),
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        const insertedAssistant = await trx
          .insertInto('app.chat_messages')
          .values({
            chat_id: chatId,
            author_userid: userId,
            role: 'assistant',
            content: result.text,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        await trx
          .updateTable('app.chats')
          .set({
            title: chat.title || 'Chat',
            last_message_at: sql`GREATEST(createdat, now())`,
          })
          .where('id', '=', chatId)
          .execute();

        return [insertedUser as ChatMessageRow, insertedAssistant as ChatMessageRow];
      });

    const noteTitlesById = await getNoteTitles(resolvedNotes.map((note) => note.id));

    return c.json<ChatsSendOutput>({
      streamId: assistantMessage.id,
      chatId,
      chatTitle: chat.title,
      messages: {
        user: toChatMessage(userMessage, noteTitlesById),
        assistant: toChatMessage(assistantMessage, noteTitlesById),
      },
      metadata: {
        startTime: Date.now(),
        timestamp: now,
      },
    });
  });

export const chatsRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', async (c) => {
    const userId = c.get('userId')!;
    const chats = (await db
      .selectFrom('app.chats')
      .selectAll()
      .where('owner_userid', '=', userId)
      .where('archived_at', 'is', null)
      .orderBy('last_message_at', 'desc')
      .limit(100)
      .execute()) as ChatRow[];

    return c.json<ChatsListOutput>(chats.map((chat) => toChat(chat)));
  })
  .post('/', zValidator('json', chatsCreateSchema), async (c) => {
    const userId = c.get('userId')!;
    const { title } = c.req.valid('json');

    const chat = await db
      .insertInto('app.chats')
      .values({
        owner_userid: userId,
        title,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return c.json<ChatsCreateOutput>(toChat(chat as ChatRow), 201);
  })
  .route('/:id', chatByIdRoutes);
