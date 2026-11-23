import { z } from 'zod';

export const RunEventInputSchema = z.object({
  eventId: z.string().min(1),
  force: z.boolean().optional(),
});

export const InjectInputSchema = z.object({
  presetId: z.string().min(1),
});
