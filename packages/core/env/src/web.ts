import * as z from 'zod';

import { baseSchema } from './base';

export const webSchema = baseSchema.extend({
  VITE_PUBLIC_API_URL: z.string().url(),
  VITE_POSTHOG_API_KEY: z.string().optional(),
  VITE_POSTHOG_HOST: z.string().url().optional().default('https://us.i.posthog.com'),
  VITE_OTEL_DISABLED: z.enum(['true', 'false']).optional().default('false'),
  VITE_OTEL_SERVICE_NAME: z.string().optional().default('hominem-web'),
  VITE_OTEL_SERVICE_VERSION: z.string().optional().default('0.0.0'),
  VITE_OTEL_DEPLOYMENT_ENVIRONMENT: z.string().optional().default('development'),
  VITE_OTEL_EXPORTER_OTLP_ENDPOINT: z
    .union([z.literal('none'), z.string().url()])
    .optional()
    .default('none'),
  VITE_OTEL_TRACES_SAMPLER_ARG: z.string().optional().default('1.0'),
});

export type WebEnv = z.infer<typeof webSchema>;
