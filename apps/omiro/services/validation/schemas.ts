import { z } from 'zod';

export const SettingsSchema = z.object({
  id: z.string(),
  theme: z.string().nullable().optional(),
  preferencesJson: z.string().nullable().optional(),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const MediaSchema = z.object({
  id: z.string(),
  type: z.string(),
  localURL: z.string(),
  createdAt: z.iso.datetime(),
});

export type Media = z.infer<typeof MediaSchema>;

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  name: z.string(),
  image: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ResumeTargetSchema = z.object({
  kind: z.enum(['chat', 'note']),
  id: z.string(),
  title: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
