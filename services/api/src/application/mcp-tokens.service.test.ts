import { db, pool } from '@hominem/db/core';
import { NotFoundError } from '@hominem/db/errors';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  MCP_TOKEN_PREFIX,
  createMcpToken,
  listMcpTokens,
  resolveMcpToken,
  revokeMcpToken,
} from './mcp-tokens.service';

const ownerId = 'd3000000-0000-4000-8000-000000000011';
const otherId = 'd3000000-0000-4000-8000-000000000012';

beforeAll(async () => {
  for (const id of [ownerId, otherId]) {
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)`,
      [id, 'MCP Tokens Service Test User', `${id}@test.hominem.dev`, true],
    );
  }
});

afterAll(async () => {
  for (const id of [ownerId, otherId]) {
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
  }
});

describe('mcp-tokens service', () => {
  it('creates a token with a prefixed raw value, a stored hash, and empty scopes', async () => {
    const created = await createMcpToken({ ownerUserId: ownerId, name: 'Muse' });

    expect(created.token).toMatch(new RegExp(`^${MCP_TOKEN_PREFIX}[A-Za-z0-9_-]{43}$`));
    expect(created.tokenPrefix).toBe(`${MCP_TOKEN_PREFIX}${created.token.slice(4, 12)}`);
    expect(created.scopes).toEqual([]);
    expect(created.revokedAt).toBeNull();

    // The raw value is never stored — only a hash, which cannot be reversed.
    const row = await db
      .selectFrom('app.mcpTokens')
      .select('tokenHash')
      .where('id', '=', created.id)
      .executeTakeFirstOrThrow();
    expect(row.tokenHash).not.toBe(created.token);
    expect(row.tokenHash).toHaveLength(64);
  });

  it('resolves a live token to the owner with empty scopes meaning all', async () => {
    const created = await createMcpToken({ ownerUserId: ownerId, name: 'Muse' });

    const resolved = await resolveMcpToken(created.token);
    expect(resolved).toEqual({ ownerUserId: ownerId, scopes: [] });
  });

  it('returns null for an unknown, malformed, or revoked token', async () => {
    const created = await createMcpToken({ ownerUserId: ownerId, name: 'Muse' });

    await expect(resolveMcpToken(`${MCP_TOKEN_PREFIX}not-a-real-token`)).resolves.toBeNull();
    await expect(resolveMcpToken('some-random-token')).resolves.toBeNull();
    await expect(resolveMcpToken('')).resolves.toBeNull();

    await revokeMcpToken({ ownerUserId: ownerId, id: created.id });
    await expect(resolveMcpToken(created.token)).resolves.toBeNull();
  });

  it("lists only the owner's active tokens, newest first", async () => {
    const first = await createMcpToken({ ownerUserId: ownerId, name: 'first' });
    const second = await createMcpToken({ ownerUserId: ownerId, name: 'second' });
    const revoked = await createMcpToken({ ownerUserId: ownerId, name: 'revoked' });
    await createMcpToken({ ownerUserId: otherId, name: 'other' });
    await revokeMcpToken({ ownerUserId: ownerId, id: revoked.id });

    const tokens = await listMcpTokens({ ownerUserId: ownerId });
    const ids = tokens.map((token) => token.id);
    expect(ids).toContain(first.id);
    expect(ids).toContain(second.id);
    expect(ids).not.toContain(revoked.id);
    const secondCreatedAt = tokens.find((token) => token.id === second.id)?.createdAt ?? '';
    const firstCreatedAt = tokens.find((token) => token.id === first.id)?.createdAt ?? '';
    expect(secondCreatedAt >= firstCreatedAt).toBe(true);
    expect(tokens.some((token) => token.name === 'other')).toBe(false);
  });

  it('revokes a token owned by the caller', async () => {
    const created = await createMcpToken({ ownerUserId: ownerId, name: 'Muse' });

    const result = await revokeMcpToken({ ownerUserId: ownerId, id: created.id });
    expect(result).toEqual({ revoked: true });

    const row = await db
      .selectFrom('app.mcpTokens')
      .select('revokedAt')
      .where('id', '=', created.id)
      .executeTakeFirstOrThrow();
    expect(row.revokedAt).not.toBeNull();
  });

  it('does not revoke a token owned by another user', async () => {
    const created = await createMcpToken({ ownerUserId: ownerId, name: 'Muse' });

    await expect(revokeMcpToken({ ownerUserId: otherId, id: created.id })).rejects.toBeInstanceOf(
      NotFoundError,
    );

    const row = await db
      .selectFrom('app.mcpTokens')
      .select('revokedAt')
      .where('id', '=', created.id)
      .executeTakeFirstOrThrow();
    expect(row.revokedAt).toBeNull();
  });

  it('does not resolve a token that was revoked by its owner', async () => {
    const created = await createMcpToken({ ownerUserId: ownerId, name: 'Muse' });
    await revokeMcpToken({ ownerUserId: ownerId, id: created.id });

    await expect(resolveMcpToken(created.token)).resolves.toBeNull();
  });
});
