import * as z from 'zod'

export const CreateBookmarkInputSchema = z.object({
  url: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  folder: z.string().optional(),
})

export const UpdateBookmarkInputSchema = z.object({
  url: z.string().min(1).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  folder: z.string().optional(),
})

export const ListBookmarksFilterSchema = z.object({
  folder: z.string().optional(),
})
