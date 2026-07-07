import * as z from 'zod'

export const itemsAddToListSchema = z.object({
  listId: z.uuid(),
  itemId: z.uuid(),
  itemType: z.enum(['FLIGHT', 'PLACE']).optional(),
})

export const itemsRemoveFromListSchema = z.object({
  listId: z.uuid(),
  itemId: z.uuid(),
})

export const itemsGetByListIdSchema = z.object({
  listId: z.uuid(),
})
