import * as z from 'zod'

export const TagEntityTypeSchema = z.enum(['note', 'task', 'person', 'chat', 'bookmark', 'place'])

export const CreateTagInputSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  description: z.string().optional(),
  emojiImageUrl: z.string().optional(),
})

export const UpdateTagInputSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  description: z.string().optional(),
  emojiImageUrl: z.string().optional(),
})

export const TaggingInputSchema = z.object({
  entityId: z.string().min(1),
  entityType: TagEntityTypeSchema,
})

export const TagSyncInputSchema = z.object({
  entityId: z.string().min(1),
  entityType: TagEntityTypeSchema,
  tagIds: z.array(z.uuid()).optional(),
})
