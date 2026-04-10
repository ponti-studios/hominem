import * as z from 'zod';

export const NoteContentTypeSchema = z
  .enum([
    'note',
    'document',
    'task',
    'timer',
    'journal',
    'tweet',
    'essay',
    'blog_post',
    'social_post',
  ])
  .describe('NoteContentType');
export const NoteStatusSchema = z.enum(['draft', 'published', 'archived']).describe('NoteStatus');
const AllContentTypeSchema = NoteContentTypeSchema.describe('AllContentType');
const ContentTagSchema = z.object({ value: z.string() });
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
export const TaskStatusSchema = z
  .enum(['todo', 'pending', 'in_progress', 'done', 'completed', 'cancelled'])
  .describe('TaskStatus');
export const TaskPrioritySchema = z
  .enum(['low', 'medium', 'high', 'urgent'])
  .describe('TaskPriority');

export type AllContentType = z.infer<typeof AllContentTypeSchema>;
export type ContentTag = z.infer<typeof ContentTagSchema>;
export type NoteAnalysis = z.infer<typeof NoteAnalysisSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

const NoteFileSchema = z.object({
  id: z.string().uuid(),
  originalName: z.string(),
  mimetype: z.string(),
  size: z.number(),
  url: z.string(),
  uploadedAt: z.string(),
  content: z.string().optional(),
  textContent: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const NoteMentionSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const NoteSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  type: NoteContentTypeSchema,
  status: NoteStatusSchema,
  title: z.string().nullable(),
  content: z.string(),
  excerpt: z.string().nullable(),
  tags: z.array(ContentTagSchema),
  mentions: z.array(NoteMentionSchema).nullable(),
  analysis: NoteAnalysisSchema.nullable(),
  publishingMetadata: PublishingMetadataSchema.nullable(),
  parentNoteId: z.string().nullable(),
  files: z.array(NoteFileSchema),
  versionNumber: z.number(),
  isLatestVersion: z.boolean(),
  publishedAt: z.string().nullable(),
  scheduledFor: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateNoteInputSchema = z.object({
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

export const UpdateNoteInputSchema = z.object({
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

export const NotesListQuerySchema = z.object({
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

export const NotesFeedQuerySchema = z.object({
  limit: z.string().optional(),
  cursor: z.string().optional(),
});
