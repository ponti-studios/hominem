import 'dotenv/config';
import { createServerEnv } from '@hominem/env';
import { baseSchema } from '@hominem/env/base';
import * as z from 'zod';

const servicesSchema = baseSchema.extend({
  SAVE_VOICE_AUDIO: z.coerce.boolean().default(false),
  DB_MAX_CONNECTIONS: z.coerce.number().optional(),
  DB_IDLE_TIMEOUT: z.coerce.number().optional(),
  DB_MAX_LIFETIME: z.coerce.number().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  OPENAI_API_KEY: z.string().optional(),
  VITE_GOOGLE_API_KEY: z.string().optional(),
  VITE_APP_BASE_URL: z.string().url().optional(),
  APP_BASE_URL: z.string().url().optional(),
});

export const env = createServerEnv(servicesSchema, 'services');
