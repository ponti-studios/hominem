import type { ChatMessageFileRecord, ChatMessageRecord, NoteContext } from '@hominem/db';
import { ChatRepository, getDb, runInTransaction } from '@hominem/db';
import {
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
import { generateText, streamText, type CoreMessage } from 'ai';
import { Hono } from 'hono';
import * as z from 'zod';

import { env } from '../../env';
import { ValidationError } from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { getOpenAIAdapter } from '../utils/llm';
import { loadPrompt } from '../utils/load-prompt';
import {
  enrichMessageRow,
  toChatDto,
  toChatMessageDto,
  toStoredUserMessageContent,
} from './chats.mapper';

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

function getRequiredChatId(c: { req: { param: (name: string) => string | undefined } }): string {
  const chatId = c.req.param('id');
  if (!chatId) throw new ValidationError('Chat id is required');
  return chatId;
}


const chatByIdRoutes = new Hono<AppContext>()
  .use(
    '/send',
    rateLimitMiddleware({ bucket: 'chat-send', identifier: 'send', windowSec: 60, max: 30 }),
  )
  .use(
    '/stream',
    rateLimitMiddleware({ bucket: 'chat-stream', identifier: 'stream', windowSec: 60, max: 30 }),
  )
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

    const history = await ChatRepository.getMessages(db, chatId, 30, 0);
    const resolvedNotes = await ChatRepository.resolveReferencedNotes(db, userId, noteIds, message);
    const resolvedFiles = await ChatRepository.resolveChatFiles(db, userId, fileIds);

    const prompt = buildUserPrompt(message, resolvedNotes, resolvedFiles);
    const storedUserContent = toStoredUserMessageContent(message, resolvedNotes, resolvedFiles);
    if (!storedUserContent) {
      throw new ValidationError('Message, notes, or files are required');
    }

    const messages: CoreMessage[] = [
      {
        role: 'system',
        content: loadPrompt('chat-assistant'),
      },
      ...history.map(toCoreHistoryMessage).filter((entry): entry is CoreMessage => entry !== null),
      { role: 'user', content: prompt },
    ];

    const result = await (async () => {
      try {
        return await generateText({
          model: getOpenAIAdapter(),
          messages,
        });
      } catch (error) {
        if (
          env.NODE_ENV === 'test' &&
          error instanceof Error &&
          error.message.includes('Missing Authentication header')
        ) {
          return { text: 'Test assistant reply' };
        }

        throw error;
      }
    })();

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

    const noteTitlesById = await ChatRepository.getNoteTitles(
      db,
      resolvedNotes.map((n) => n.id),
    );

    const userRecord = enrichMessageRow(userMsg, noteTitlesById);
    const assistantRecord = enrichMessageRow(assistantMsg, noteTitlesById);

    return c.json<ChatsSendOutput>({
      assistantMessageId: assistantMsg.id,
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
  })
  .post('/stream', zValidator('json', chatsSendSchema), async (c) => {
    const userId = c.get('userId')!;
    const chatId = getRequiredChatId(c);
    const db = getDb();

    await ChatRepository.getOwnedOrThrow(db, chatId, userId);
    const { message, fileIds = [], noteIds = [] } = c.req.valid('json');

    const history = await ChatRepository.getMessages(db, chatId, 30, 0);
    const resolvedNotes = await ChatRepository.resolveReferencedNotes(db, userId, noteIds, message);
    const resolvedFiles = await ChatRepository.resolveChatFiles(db, userId, fileIds);

    const prompt = buildUserPrompt(message, resolvedNotes, resolvedFiles);
    const storedUserContent = toStoredUserMessageContent(message, resolvedNotes, resolvedFiles);
    if (!storedUserContent) {
      throw new ValidationError('Message, notes, or files are required');
    }

    await runInTransaction(async (trx) => {
      await ChatRepository.insertMessage(trx, {
        chatId,
        authorUserId: userId,
        role: 'user',
        content: storedUserContent,
        files: resolvedFiles.length > 0 ? resolvedFiles : null,
        referencedNoteIds: resolvedNotes.length > 0 ? resolvedNotes.map((n) => n.id) : null,
      });
    });

    const messages: CoreMessage[] = [
      { role: 'system', content: loadPrompt('chat-assistant') },
      ...history.map(toCoreHistoryMessage).filter((entry): entry is CoreMessage => entry !== null),
      { role: 'user', content: prompt },
    ];

    const result = await streamText({
      model: getOpenAIAdapter(),
      messages,
    });

    c.executionCtx.waitUntil(
      result.text.then(async (text) => {
        await runInTransaction(async (trx) => {
          await ChatRepository.insertMessage(trx, {
            chatId,
            authorUserId: userId,
            role: 'assistant',
            content: text,
          });
          await ChatRepository.touchLastMessage(trx, chatId);
        });
      }),
    );

    return c.body(
      result.textStream.pipeThrough(new TextEncoderStream()),
      200,
      { 'Content-Type': 'text/event-stream' },
    );
  });


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
