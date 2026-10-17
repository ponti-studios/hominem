import { z } from 'zod';

export const travelEntityHistoryInputSchema = z.object({
  entityType: z.enum([
    'journey',
    'segment',
    'transport',
    'stay',
    'place',
    'airport',
    'idea',
    'residence',
  ]),
  id: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(50),
});
export const travelExportInputSchema = z.object({});
export const travelGenericOutputSchema = z.record(z.string(), z.unknown());
