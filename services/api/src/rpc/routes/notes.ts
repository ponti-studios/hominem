import { getDb, NoteRepository } from '@hominem/db';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import { NoteService } from '../../application/notes.service';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { toNoteDto, toNoteFeedItemDto } from './notes.mapper';

const NoteContentTypeSchema = z.enum([
  'note',
  'document',
  'task',
  'timer',
  'journal',
  'tweet',
  'essay',
  'blog_post',
  'social_post',
]);
const NoteStatusSchema = z.enum(['draft', 'published', 'archived']);
const ContentTagSchema = z.object({ value: z.string() });
const NoteMentionSchema = z.object({ id: z.string(), name: z.string() });
const PublishingMetadataSchema = z.object({
  platform: z.string().optional(),
  url: z.string().optional(),
  externalId: z.string().optional(),
  seo: z
    .object({
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      canonicalUrl: z.string().optional(),
      featuredImage: z.string().optional(),
    })
    .optional(),
  metrics: z
    .object({
      views: z.number().optional(),
      likes: z.number().optional(),
      reposts: z.number().optional(),
      replies: z.number().optional(),
      clicks: z.number().optional(),
    })
    .optional(),
  threadPosition: z.number().optional(),
  threadId: z.string().optional(),
  inReplyTo: z.string().optional(),
  scheduledFor: z.string().optional(),
  importedAt: z.string().optional(),
  importedFrom: z.string().optional(),
});
const NoteAnalysisSchema = z.object({
  readingTimeMinutes: z.number().optional(),
  summary: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  language: z.string().optional(),
});

const CreateNoteInputSchema = z.object({
  type: NoteContentTypeSchema.default('note'),
  status: NoteStatusSchema.default('draft').optional(),
  title: z.string().optional(),
  content: z.string(),
  fileIds: z.array(z.uuid()).max(5).optional(),
  excerpt: z.string().optional(),
  tags: z.array(ContentTagSchema).optional().default([]),
  mentions: z.array(NoteMentionSchema).optional().default([]),
  publishingMetadata: PublishingMetadataSchema.optional(),
  analysis: NoteAnalysisSchema.optional(),
});

const UpdateNoteInputSchema = z.object({
  type: NoteContentTypeSchema.optional(),
  status: NoteStatusSchema.optional(),
  title: z.string().nullish(),
  content: z.string().optional(),
  fileIds: z.array(z.uuid()).max(5).optional(),
  excerpt: z.string().nullish(),
  scheduledFor: z.string().nullable().optional(),
  tags: z.array(ContentTagSchema).nullish(),
  publishingMetadata: PublishingMetadataSchema.optional().nullish(),
  analysis: NoteAnalysisSchema.optional().nullish(),
});

const NotesListQuerySchema = z.object({
  types: z.string().optional(),
  status: z.string().optional(),
  tags: z.string().optional(),
  query: z.string().optional(),
  since: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
  includeAllVersions: z.string().optional(),
});

const NotesFeedQuerySchema = z.object({
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

const noteParamSchema = z.object({ id: z.uuid() });
const noteSearchQuerySchema = z.object({
  query: z.string().trim().min(1),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});
const noteService = new NoteService();

export const notesRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', zValidator('query', NotesListQuerySchema), async (c) => {
    const userId = c.get('userId')!;
    const query = c.req.valid('query');

    const notes = await NoteRepository.list(getDb(), {
      userId,
      ...(query.limit ? { limit: Number.parseInt(query.limit, 10) } : {}),
      ...(query.offset ? { offset: Number.parseInt(query.offset, 10) } : {}),
      ...(query.since ? { since: query.since } : {}),
      ...(query.query ? { query: query.query } : {}),
      ...(query.sortBy ? { sortBy: query.sortBy as 'createdAt' | 'updatedAt' | 'title' } : {}),
      ...(query.sortOrder ? { sortOrder: query.sortOrder as 'asc' | 'desc' } : {}),
    });

    return c.json({
      notes: notes.map(toNoteDto),
    });
  })
  .get('/feed', zValidator('query', NotesFeedQuerySchema), async (c) => {
    const userId = c.get('userId')!;
    const query = c.req.valid('query');
    const feed = await NoteRepository.listFeed(getDb(), {
      userId,
      ...(query.limit ? { limit: Number.parseInt(query.limit, 10) } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });

    return c.json({
      notes: feed.notes.map(toNoteFeedItemDto),
      nextCursor: feed.nextCursor,
    });
  })
  .get('/search', zValidator('query', noteSearchQuerySchema), async (c) => {
    const userId = c.get('userId')!;
    const query = c.req.valid('query');
    const limit = query.limit ? Math.min(Number.parseInt(query.limit, 10), 20) : 10;

    const results = await NoteRepository.search(getDb(), {
      userId,
      query: query.query,
      limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });

    return c.json(results);
  })
  .post('/', zValidator('json', CreateNoteInputSchema), async (c) => {
    const userId = c.get('userId')!;
    const input = c.req.valid('json');
    const note = await noteService.createNote(userId, {
      title: input.title ?? null,
      content: input.content,
      ...(input.fileIds ? { fileIds: input.fileIds } : {}),
    });

    return c.json(toNoteDto(note), 201);
  })
  .get('/:id', zValidator('param', noteParamSchema), async (c) => {
    const userId = c.get('userId')!;
    const { id } = c.req.valid('param');
    const note = await NoteRepository.load(getDb(), id, userId);
    return c.json(toNoteDto(note));
  })
  .patch(
    '/:id',
    zValidator('param', noteParamSchema),
    zValidator('json', UpdateNoteInputSchema),
    async (c) => {
      const userId = c.get('userId')!;
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');

      const note = await noteService.updateNote(id, userId, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.fileIds ? { fileIds: input.fileIds } : {}),
      });

      return c.json(toNoteDto(note));
    },
  )
  .delete('/:id', zValidator('param', noteParamSchema), async (c) => {
    const userId = c.get('userId')!;
    const { id } = c.req.valid('param');

    const note = await NoteRepository.load(getDb(), id, userId);
    await NoteRepository.hardDelete(getDb(), id, userId);

    return c.json(toNoteDto(note));
  })
  .post('/:id/archive', zValidator('param', noteParamSchema), async (c) => {
    const userId = c.get('userId')!;
    const { id } = c.req.valid('param');
    const note = await NoteRepository.load(getDb(), id, userId);
    await NoteRepository.archive(getDb(), id, userId);
    return c.json(toNoteDto(note));
  })
  .post('/:id/unarchive', zValidator('param', noteParamSchema), async (c) => {
    const userId = c.get('userId')!;
    const { id } = c.req.valid('param');
    await NoteRepository.unarchive(getDb(), id, userId);
    const note = await NoteRepository.load(getDb(), id, userId);
    return c.json(toNoteDto(note));
  });
