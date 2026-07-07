import * as z from 'zod'

export type NoteContentType =
  | 'note'
  | 'document'
  | 'task'
  | 'timer'
  | 'journal'
  | 'tweet'
  | 'essay'
  | 'blog_post'
  | 'social_post'

export type AllContentType = NoteContentType

export type ContentTag = {
  value: string
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'archived'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type NoteAnalysis = Record<string, unknown>

export const NoteContentTypeSchema = z.enum([
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

export const AllContentTypeSchema = NoteContentTypeSchema

export const NoteStatusSchema = z.enum(['draft', 'published', 'archived'])

export const TaskStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'archived'])

export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent'])

export const ContentTagSchema = z.object({
  value: z.string().min(1),
})

export const NoteAnalysisSchema = z.record(z.string(), z.unknown())

const PublishingMetadataSchema = z
  .object({
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
  })
  .passthrough()

const NoteMentionSchema = z.object({
  id: z.string(),
  name: z.string(),
})

const NoteSyncItemSchema = z.object({
  id: z.string().optional(),
  type: NoteContentTypeSchema,
  status: NoteStatusSchema.optional(),
  title: z.string().nullish(),
  content: z.string(),
  excerpt: z.string().nullish(),
  tags: z.array(ContentTagSchema).optional(),
  mentions: z.array(NoteMentionSchema).optional(),
  publishingMetadata: PublishingMetadataSchema.optional().nullable(),
  analysis: NoteAnalysisSchema.optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  publishedAt: z.string().optional(),
  scheduledFor: z.string().optional(),
})

export const CreateNoteInputSchema = z.object({
  type: NoteContentTypeSchema.default('note'),
  status: NoteStatusSchema.optional(),
  title: z.string().optional(),
  content: z.string(),
  fileIds: z.array(z.uuid()).max(5).optional(),
  excerpt: z.string().optional(),
  tags: z.array(ContentTagSchema).optional(),
  mentions: z.array(NoteMentionSchema).optional(),
  analysis: NoteAnalysisSchema.optional().nullable(),
  publishingMetadata: PublishingMetadataSchema.optional(),
})

export const UpdateNoteInputSchema = z.object({
  type: NoteContentTypeSchema.optional(),
  status: NoteStatusSchema.optional(),
  title: z.string().nullish(),
  content: z.string().optional(),
  fileIds: z.array(z.uuid()).max(5).optional(),
  excerpt: z.string().nullish(),
  scheduledFor: z.string().nullish(),
  tags: z.array(ContentTagSchema).optional().nullable(),
  analysis: NoteAnalysisSchema.optional().nullable(),
  publishingMetadata: PublishingMetadataSchema.optional().nullable(),
})

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
})

export const NotesFeedQuerySchema = z.object({
  limit: z.string().optional(),
  cursor: z.string().optional(),
})

export const NoteParamSchema = z.object({ id: z.uuid() })

export const NoteSearchQuerySchema = z.object({
  query: z.string().trim().min(1),
  limit: z.string().optional(),
  cursor: z.string().optional(),
})

export const PublishNoteSchema = z.object({
  platform: z.string().optional(),
  url: z.string().optional(),
  externalId: z.string().optional(),
  seo: PublishingMetadataSchema.shape.seo.optional(),
})

export const NotesSyncSchema = z.object({
  items: z.array(NoteSyncItemSchema),
})
