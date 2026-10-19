import { runtimeSchema } from '@hominem/env/runtime';
import { z } from 'zod';

export const financeSchema = runtimeSchema.extend({
  VITE_PUBLIC_API_URL: z.url(),
  HOMINEM_INTERNAL_API_URL: z.url(),
  PUBLIC_APP_URL: z.url(),
  VITE_R2_DOMAIN: z.string().optional(),
});

export const financeClientSchema = financeSchema.pick({
  VITE_PUBLIC_API_URL: true,
  VITE_R2_DOMAIN: true,
});

export type FinanceEnv = z.infer<typeof financeSchema>;
export type FinanceClientEnv = z.infer<typeof financeClientSchema>;
