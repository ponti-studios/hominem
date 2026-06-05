import type { ChatMessageFileRecord, ChatMessageRecord, NoteContext } from '@hominem/db';
import { ChatRepository, db, runInTransaction } from '@hominem/db';
import { streamChatCompletion } from '@hominem/ai';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import * as z from 'zod';

const chatsSendSchema = z
  .object({
    message: z.string(),
    fileIds: z.array(z.uuid()).max(5).optional(),
    noteIds: z.array(z.uuid()).max(10).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.message.trim().length === 0 &&
      (!value.fileIds || value.fileIds.length === 0) &&
      (!value.noteIds || value.noteIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'message, fileIds, or noteIds is required',
        path: ['message'],
      });
    }
  });

import { ValidationError } from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { loadPrompt } from '../utils/load-prompt';
import { toChatDto, toChatMessageDto, toStoredUserMessageContent } from './chats.mapper';

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

function buildPrompt(
  message: string,
  history: ChatMessageRecord[],
  notes: NoteContext[],
  files: ChatMessageFileRecord[],
): string {
  const sections = [];

  if (history.length > 0) {
    sections.push(
      [
        'Conversation history:',
        ...history.map((entry, index) => `${index + 1}. ${entry.role}: ${entry.content}`),
      ].join('\n'),
    );
  }

  sections.push(message.trim());

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

function getChatId(c: { req: { param: (name: string) => string | undefined } }): string {
  const chatId = c.req.param('id');
  if (!chatId) throw new ValidationError('Chat id is required');
  return chatId;
}

const chatByIdRoutes = new Hono<AppContext>()
  .use(
    '/stream',
    rateLimitMiddleware({ bucket: 'chat-stream', windowSec: 60, max: 30 }),
  )
  .get('/', async (c) => {
    const userId = c.get('userId')!;
    const chatId = getChatId(c);

    const chat = await ChatRepository.getOwnedOrThrow(db, chatId, userId);
    const messages = await ChatRepository.getMessages(db, chatId, 100, 0);

    return c.json({
      ...toChatDto(chat),
      messages: messages.map(toChatMessageDto),
    });
  })
  .delete('/', async (c) => {
    const userId = c.get('userId')!;
    const chatId = getChatId(c);

    await ChatRepository.getOwnedOrThrow(db, chatId, userId);
    await ChatRepository.delete(db, chatId, userId);

    return c.json({ success: true });
  })
  .patch('/', zValidator('json', chatsUpdateSchema), async (c) => {
    const userId = c.get('userId')!;
    const chatId = getChatId(c);
    const { title } = c.req.valid('json');

    await ChatRepository.getOwnedOrThrow(db, chatId, userId);
    await ChatRepository.updateTitle(db, chatId, userId, title);

    return c.json({ success: true });
  })
  .post('/archive', async (c) => {
    const userId = c.get('userId')!;
    const chatId = getChatId(c);

    await ChatRepository.getOwnedOrThrow(db, chatId, userId);
    const archived = await ChatRepository.archive(db, chatId, userId);

    return c.json(toChatDto(archived));
  })
  .get('/messages', zValidator('query', chatsMessagesQuerySchema), async (c) => {
    const userId = c.get('userId')!;
    const chatId = getChatId(c);

    await ChatRepository.getOwnedOrThrow(db, chatId, userId);
    const query = c.req.valid('query');
    const limit = query.limit ? Number.parseInt(query.limit, 10) : 100;
    const offset = query.offset ? Number.parseInt(query.offset, 10) : 0;

    const messages = await ChatRepository.getMessages(db, chatId, limit, offset);
    return c.json(messages.map(toChatMessageDto));
  })
  .post('/stream', zValidator('json', chatsSendSchema), async (c) => {
    const userId = c.get('userId')!;
    const chatId = getChatId(c);

    await ChatRepository.getOwnedOrThrow(db, chatId, userId);
    const { message, fileIds = [], noteIds = [] } = c.req.valid('json');

    const history = await ChatRepository.getMessages(db, chatId, 30, 0);
    const resolvedNotes = await ChatRepository.resolveReferencedNotes(db, userId, noteIds, message);
    const resolvedFiles = await ChatRepository.resolveChatFiles(db, userId, fileIds);

    const storedUserContent = toStoredUserMessageContent(message, resolvedNotes, resolvedFiles);
    if (!storedUserContent) {
      throw new ValidationError('Message, notes, or files are required');
    }

    await ChatRepository.insertMessage(db, {
      chatId,
      authorUserId: userId,
      role: 'user',
      content: storedUserContent,
      files: resolvedFiles.length > 0 ? resolvedFiles : null,
      referencedNoteIds: resolvedNotes.length > 0 ? resolvedNotes.map((n) => n.id) : null,
    });
    const prompt = buildPrompt(message, history, resolvedNotes, resolvedFiles);
    const completion = streamChatCompletion({
      messages: [
        { role: 'system', content: loadPrompt('chat-assistant') },
        { role: 'user', content: prompt },
      ],
    });

    return streamSSE(c, async (stream) => {
      let assistantText = '';

      try {
        for await (const chunk of completion) {
          const text = chunk.choices?.[0]?.delta?.content;
          if (typeof text === 'string' && text.length > 0) {
            assistantText += text;
            await stream.writeSSE({ data: JSON.stringify({ chunk: text }) });
          }
        }

        await stream.writeSSE({ data: '[DONE]' });

        if (assistantText.trim().length > 0) {
          await runInTransaction(async (trx) => {
            await ChatRepository.insertMessage(trx, {
              chatId,
              authorUserId: userId,
              role: 'assistant',
              content: assistantText,
            });
            await ChatRepository.touchLastMessage(trx, chatId);
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Stream error';
        await stream.writeSSE({ data: JSON.stringify({ error: message }) });
      }
    });
  });

export const chatsRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', async (c) => {
    const userId = c.get('userId')!;
    const chats = await ChatRepository.listForUser(db, userId, 100);
    return c.json(chats.map(toChatDto));
  })
  .post('/', zValidator('json', chatsCreateSchema), async (c) => {
    const userId = c.get('userId')!;
    const { title } = c.req.valid('json');
    const chat = await ChatRepository.create(db, { userId, title });
    return c.json(toChatDto(chat), 201);
  })
  .route('/:id', chatByIdRoutes);
