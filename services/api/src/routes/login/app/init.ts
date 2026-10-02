import { z } from 'zod';

const resumeModeSchema = z.enum(['app', 'oauth']);
export type ResumeMode = z.infer<typeof resumeModeSchema>;

export const loginInitSchema = z.object({
  mode: resumeModeSchema,
  resumeQuery: z.string(),
  email: z.string(),
  step: z.enum(['email', 'otp']),
  error: z.string().optional(),
});
export type LoginInit = z.infer<typeof loginInitSchema>;

export const consentInitSchema = z.object({
  clientName: z.string(),
  query: z.string(),
  scopes: z.array(z.string()),
  error: z.string().optional(),
});
export type ConsentInit = z.infer<typeof consentInitSchema>;

export const logoutInitSchema = z.object({
  signedOut: z.boolean(),
});
export type LogoutInit = z.infer<typeof logoutInitSchema>;

export const errorInitSchema = z.object({
  description: z.string().optional(),
  error: z.string().optional(),
  mode: resumeModeSchema.optional(),
});
export type ErrorInit = z.infer<typeof errorInitSchema>;

export const settingsInitSchema = z.object({
  user: z.object({ id: z.string(), name: z.string().nullable(), email: z.string().nullable() }),
  loginNextUrl: z.string(),
});
export type SettingsInit = z.infer<typeof settingsInitSchema>;

declare global {
  interface Window {
    __AUTH_INIT__?: unknown;
  }
}

export function readAuthInit<TSchema extends z.ZodType>(schema: TSchema): z.output<TSchema> {
  return schema.parse(window.__AUTH_INIT__);
}
