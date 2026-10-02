import { z } from 'zod';

export const removedResultSchema = z.object({ removed: z.boolean() });
