import * as z from 'zod';
import { baseSchema } from './base';

export const webSchema = baseSchema.extend({
  VITE_PUBLIC_API_URL: z.string().url(),
  VITE_R2_DOMAIN: z.string().optional(),
  VITE_POSTHOG_API_KEY: z.string().optional(),
  VITE_POSTHOG_HOST: z.string().url().optional().default('https://us.i.posthog.com'),
});

export type WebEnv = z.infer<typeof webSchema>;
