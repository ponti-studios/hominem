import { createHash, randomBytes } from 'node:crypto';

import { db, sql } from '@hominem/db/core';
import { NotFoundError } from '@hominem/db/errors';
import { redis } from '@hominem/services/redis';
import { logger } from '@hominem/telemetry';

// Personal access tokens for the MCP server. The raw `hmt_` value is minted
// once, stored only as a SHA-256 hash, and never recoverable afterwards — the
// service is the single implementation shared by the /auth/settings endpoints
// and the /api/mcp bearer-token resolver.

export const MCP_TOKEN_PREFIX = 'hmt_';
const TOKEN_HASH_ALGORITHM = 'sha256';
const TOKEN_RANDOM_BYTES = 32;
// Successful resolutions are cached briefly so a chatty MCP session doesn't
// pay a database round-trip per call. Revocation deletes the entry; if that
// delete fails the cache TTL is the worst-case revocation lag.
const TOKEN_CACHE_TTL_SECONDS = 60;

function hashToken(rawToken: string): string {
  return createHash(TOKEN_HASH_ALGORITHM).update(rawToken).digest('hex');
}

function mintRawToken(): string {
  return `${MCP_TOKEN_PREFIX}${randomBytes(TOKEN_RANDOM_BYTES).toString('base64url')}`;
}

type ResolvedMcpToken = { ownerUserId: string; scopes: string[] };

function tokenCacheKey(tokenHash: string): string {
  return `mcp:token:${tokenHash}`;
}

async function readCachedToken(tokenHash: string): Promise<ResolvedMcpToken | null> {
  try {
    const cached = await redis.get(tokenCacheKey(tokenHash));
    if (!cached) return null;
    const parsed: ResolvedMcpToken = JSON.parse(cached);
    return parsed;
  } catch (error) {
    logger.warn('mcp_token_cache_read_failed', {
      error_name: error instanceof Error ? error.name : 'unknown',
    });
    return null;
  }
}

async function writeCachedToken(tokenHash: string, token: ResolvedMcpToken): Promise<void> {
  try {
    await redis.set(tokenCacheKey(tokenHash), JSON.stringify(token), 'EX', TOKEN_CACHE_TTL_SECONDS);
  } catch (error) {
    logger.warn('mcp_token_cache_write_failed', {
      error_name: error instanceof Error ? error.name : 'unknown',
    });
  }
}

async function invalidateCachedToken(tokenHash: string): Promise<void> {
  try {
    await redis.del(tokenCacheKey(tokenHash));
  } catch (error) {
    logger.warn('mcp_token_cache_invalidate_failed', {
      error_name: error instanceof Error ? error.name : 'unknown',
    });
  }
}

function tokenPrefixFor(rawToken: string): string {
  return `${MCP_TOKEN_PREFIX}${rawToken.slice(MCP_TOKEN_PREFIX.length, MCP_TOKEN_PREFIX.length + 8)}`;
}

export type McpTokenRow = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

export async function createMcpToken(input: {
  ownerUserId: string;
  name: string;
}): Promise<McpTokenRow & { token: string }> {
  const rawToken = mintRawToken();
  const row = await db
    .insertInto('app.mcpTokens')
    .values({
      ownerUserid: input.ownerUserId,
      name: input.name,
      tokenPrefix: tokenPrefixFor(rawToken),
      tokenHash: hashToken(rawToken),
    })
    .returning(['id', 'name', 'tokenPrefix', 'scopes', 'lastUsedAt', 'createdAt', 'revokedAt'])
    .executeTakeFirstOrThrow();

  return {
    ...row,
    scopes: row.scopes ?? [],
    lastUsedAt: row.lastUsedAt ?? null,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt ?? null,
    token: rawToken,
  };
}

export async function listMcpTokens(input: { ownerUserId: string }): Promise<McpTokenRow[]> {
  const rows = await db
    .selectFrom('app.mcpTokens')
    .select(['id', 'name', 'tokenPrefix', 'scopes', 'lastUsedAt', 'createdAt', 'revokedAt'])
    .where('ownerUserid', '=', input.ownerUserId)
    .where('revokedAt', 'is', null)
    .orderBy('createdAt', 'desc')
    .execute();

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    scopes: row.scopes ?? [],
    lastUsedAt: row.lastUsedAt ?? null,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt ?? null,
  }));
}

export async function revokeMcpToken(input: {
  ownerUserId: string;
  id: string;
}): Promise<{ revoked: boolean }> {
  const result = await db
    .updateTable('app.mcpTokens')
    .set({ revokedAt: sql`now()`, updatedAt: sql`now()` })
    .where('id', '=', input.id)
    .where('ownerUserid', '=', input.ownerUserId)
    .where('revokedAt', 'is', null)
    .returning('tokenHash')
    .executeTakeFirst();

  if (!result) throw new NotFoundError('MCP token not found');
  await invalidateCachedToken(result.tokenHash);
  return { revoked: true };
}

/**
 * Resolves a raw `hmt_` bearer token to an owner + scope allow-list, or null
 * when the token is unknown, revoked, or malformed. The empty scopes array
 * means "all MCP scopes" and is resolved by the caller against the live
 * MCP_SCOPES set.
 */
export async function resolveMcpToken(rawToken: string): Promise<{
  ownerUserId: string;
  scopes: string[];
} | null> {
  if (!rawToken.startsWith(MCP_TOKEN_PREFIX)) return null;

  const tokenHash = hashToken(rawToken);
  const cached = await readCachedToken(tokenHash);
  if (cached) return cached;

  const row = await db
    .selectFrom('app.mcpTokens')
    .select(['ownerUserid', 'scopes'])
    .where('tokenHash', '=', tokenHash)
    .where('revokedAt', 'is', null)
    .executeTakeFirst();

  if (!row) return null;

  const resolved = { ownerUserId: row.ownerUserid, scopes: row.scopes ?? [] };
  await writeCachedToken(tokenHash, resolved);

  await db
    .updateTable('app.mcpTokens')
    .set({ lastUsedAt: sql`now()` })
    .where('tokenHash', '=', tokenHash)
    .execute();

  return resolved;
}
