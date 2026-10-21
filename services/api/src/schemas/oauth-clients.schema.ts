import { z } from 'zod';

const oauthClientSchema = z.object({
  clientId: z.string(),
  name: z.string().nullable(),
  uri: z.string().nullable(),
  icon: z.string().nullable(),
  scopes: z.array(z.string()),
  authorizedAt: z.string(),
});

export const listOAuthClientsOutputSchema = z.object({
  clients: z.array(oauthClientSchema),
});

export const revokeOAuthClientInputSchema = z.object({
  clientId: z.string().min(1).max(512),
});

export const revokeOAuthClientOutputSchema = z.object({
  revoked: z.boolean(),
});
