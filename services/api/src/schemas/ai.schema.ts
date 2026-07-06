import * as z from 'zod';

export const AIUsageQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

export type AIUsageQuery = z.infer<typeof AIUsageQuerySchema>;
