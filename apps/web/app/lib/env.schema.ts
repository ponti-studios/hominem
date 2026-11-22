import { runtimeSchema } from '@hominem/env/runtime';
import { z } from 'zod';

const blankAsUndefined = (value: unknown) => (value === '' ? undefined : value);

export const webSchema = runtimeSchema.extend({
  VITE_PUBLIC_API_URL: z.url(),
  HOMINEM_INTERNAL_API_URL: z.url(),
  PUBLIC_APP_URL: z.url(),
  VITE_CAREER_PDF_WORKER_URL: z.preprocess(blankAsUndefined, z.url().optional()),
  VITE_POSTHOG_PROJECT_TOKEN: z.preprocess(blankAsUndefined, z.string().optional()),
  VITE_POSTHOG_HOST: z.preprocess(
    blankAsUndefined,
    z.url().optional().default('https://us.i.posthog.com'),
  ),
});
