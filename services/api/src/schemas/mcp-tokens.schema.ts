import { z } from 'zod';

// ── shared ───────────────────────────────────────────────────────────

const mcpTokenSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  tokenPrefix: z.string(),
  // Empty array means "all MCP scopes" (resolved at request time); a non-empty
  // array is the explicit allow-list. Null is never stored — the UI shows
  // "All scopes" for the empty-array case.
  scopes: z.array(z.string()),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  revokedAt: z.string().nullable(),
});

// ── create ───────────────────────────────────────────────────────────

export const createMcpTokenInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const createMcpTokenOutputSchema = mcpTokenSchema.extend({
  // Raw token value, shown exactly once at creation and never retrievable again.
  token: z.string(),
});

// ── list ─────────────────────────────────────────────────────────────

export const listMcpTokensOutputSchema = z.object({
  tokens: z.array(mcpTokenSchema),
  count: z.number().int().min(0),
});

// ── revoke ───────────────────────────────────────────────────────────

export const revokeMcpTokenInputSchema = z.object({
  id: z.string().uuid(),
});

export const revokeMcpTokenOutputSchema = z.object({
  revoked: z.boolean(),
});
