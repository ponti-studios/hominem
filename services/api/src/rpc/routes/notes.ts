import { randomUUID } from 'node:crypto';

import {
  createChatCompletion,
  ENHANCE_MODEL,
  getChatCompletionText,
  getChatCompletionUsage,
} from '@hominem/ai';
import { logger } from '@hominem/telemetry';
import { Hono } from 'hono';

import {
  assertAIUsageAllowed,
  recordAIUsageEvent,
  startAIUsageTimer,
} from '../../application/ai-usage.service';
import { NoteService } from '../../application/notes.service';
import {
  CreateNoteInputSchema,
  GenerateNoteFromChatInputSchema,
  NoteParamSchema,
  NoteSearchQuerySchema,
  UpdateNoteInputSchema,
} from '../../schemas/notes.schema';
import { NotFoundError } from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { CHAT_TO_NOTE_PROMPT } from '../prompts';
import { zValidator } from '../validator';
import { toNoteDto } from './notes.mapper';
const noteService = new NoteService();

export const notesRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/search', zValidator('query', NoteSearchQuerySchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const query = c.req.valid('query');
    const limit = query.limit ? Math.min(Number.parseInt(query.limit, 10), 20) : 10;

    const results = await noteService.searchNotes(userId, {
      query: query.query,
      limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });

    return c.json(results);
  })
  .post('/', zValidator('json', CreateNoteInputSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const input = c.req.valid('json');
    const note = await noteService.createNote(userId, {
      title: input.title ?? null,
      content: input.content,
      ...(input.fileIds ? { fileIds: input.fileIds } : {}),
    });

    return c.json(await toNoteDto(note), 201);
  })
  .use('/generate', rateLimitMiddleware({ bucket: 'ai-note-generate', windowSec: 60, max: 20 }))
  .post('/generate', zValidator('json', GenerateNoteFromChatInputSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const { transcript, instruction } = c.req.valid('json');

    await assertAIUsageAllowed(userId, c.get('auth')!.user.isAdmin);

    const eventId = randomUUID();
    const getDurationMs = startAIUsageTimer();

    try {
      const response = await createChatCompletion({
        model: ENHANCE_MODEL,
        messages: [
          { role: 'system', content: CHAT_TO_NOTE_PROMPT },
          {
            role: 'user',
            content: instruction
              ? `Instruction: ${instruction}\n\nConversation transcript:\n${transcript}`
              : `Conversation transcript:\n${transcript}`,
          },
        ],
        temperature: 0.4,
        maxCompletionTokens: 4000,
      });
      const responseText = getChatCompletionText(response).trim();
      if (!responseText) {
        throw new Error('Model returned an empty note');
      }
      const generated = {
        text: responseText,
        usage: getChatCompletionUsage(response),
      };
      await recordAIUsageEvent({
        eventId,
        userId,
        feature: 'note_generate',
        operation: 'chat_completion',
        usage: generated.usage,
        status: 'succeeded',
        durationMs: getDurationMs(),
        metadata: {
          instructionProvided: Boolean(instruction),
          transcriptLength: transcript.length,
        },
      });
      return c.json({ text: generated.text });
    } catch (error) {
      await recordAIUsageEvent({
        eventId,
        userId,
        feature: 'note_generate',
        operation: 'chat_completion',
        status: 'failed',
        error,
        durationMs: getDurationMs(),
      });
      logger.error('ai_note_generate_failed', {
        operation: 'ai.note_generate',
        failureType: 'ai.note_generate.failed',
        error_name: error instanceof Error ? error.name : 'unknown',
      });
      return c.json(
        { error: 'Note generation failed', failureType: 'ai.note_generate.failed' },
        500,
      );
    }
  })
  .get('/:id', zValidator('param', NoteParamSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const { id } = c.req.valid('param');
    const note = await noteService.getOwnedNote(userId, id);
    if (!note) throw new NotFoundError('Note', { id });
    return c.json(await toNoteDto(note));
  })
  .patch(
    '/:id',
    zValidator('param', NoteParamSchema),
    zValidator('json', UpdateNoteInputSchema),
    async (c) => {
      const userId = c.get('auth')!.userId;
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');

      const note = await noteService.updateOwnedNote(userId, id, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.fileIds ? { fileIds: input.fileIds } : {}),
      });
      if (!note) throw new NotFoundError('Note', { id });

      return c.json(await toNoteDto(note));
    },
  )
  .delete('/:id', zValidator('param', NoteParamSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const { id } = c.req.valid('param');

    const note = await noteService.deleteNote(userId, id);
    if (!note) throw new NotFoundError('Note', { id });

    return c.json(await toNoteDto(note));
  });
