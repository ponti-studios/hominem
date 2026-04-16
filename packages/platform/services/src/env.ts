import 'dotenv/config';
import { createServerEnv } from '@hominem/env';
import { baseSchema } from '@hominem/env/base';
import * as z from 'zod';

const servicesSchema = baseSchema.extend({
  DB_MAX_CONNECTIONS: z.coerce.number().optional(),
  DB_IDLE_TIMEOUT: z.coerce.number().optional(),
  DB_MAX_LIFETIME: z.coerce.number().optional(),

  APP_BASE_URL: z.string().url().optional(),
});

export const env = createServerEnv(servicesSchema, 'services');
