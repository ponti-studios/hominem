import { randomUUID } from 'node:crypto';

import { pool } from '@hominem/db/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { listOAuthClients, revokeOAuthClient } from './oauth-clients.service';

const userId = 'd5000000-0000-4000-8000-000000000051';
const otherId = 'd5000000-0000-4000-8000-000000000052';
const suffix = randomUUID().replaceAll('-', '');
const clientA = `zz_client_a_${suffix}`;
const clientB = `zz_client_b_${suffix}`;
const future = new Date(Date.now() + 86_400_000);

async function clean() {
  const clients = [clientA, clientB];
  await pool.query(`DELETE FROM "oauthAccessToken" WHERE "clientId" = ANY($1)`, [clients]);
  await pool.query(`DELETE FROM "oauthRefreshToken" WHERE "clientId" = ANY($1)`, [clients]);
  await pool.query(`DELETE FROM "oauthConsent" WHERE "clientId" = ANY($1)`, [clients]);
  await pool.query(`DELETE FROM "oauthClient" WHERE "clientId" = ANY($1)`, [clients]);
  await pool.query(`DELETE FROM "user" WHERE id = ANY($1)`, [[userId, otherId]]);
}

async function addRefresh(user: string, clientId: string) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO "oauthRefreshToken" (id, token, "clientId", "userId", "expiresAt", scopes)
     VALUES ($1, $2, $3, $4, $5, 'openid offline_access')`,
    [id, `tok_${id}`, clientId, user, future],
  );
  return id;
}

beforeAll(async () => {
  await clean();
  for (const [id, email] of [
    [userId, 'oauth-clients-test@work.hominem.dev'],
    [otherId, 'oauth-clients-other@work.hominem.dev'],
  ] as const) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, 'Test', $2, true)`,
      [id, email],
    );
  }
  await pool.query(
    `INSERT INTO "oauthClient" (id, "clientId", name, "redirectUris") VALUES
       ($1, $2, 'Client A', 'http://localhost/cb'), ($3, $4, NULL, 'http://localhost/cb')`,
    [randomUUID(), clientA, randomUUID(), clientB],
  );
});

afterAll(async () => {
  await clean();
});

describe('oauth clients service', () => {
  it('lists clients granted through consent or a live refresh token, scoped to the user', async () => {
    await pool.query(
      `INSERT INTO "oauthConsent" (id, "clientId", "userId", scopes) VALUES ($1, $2, $3, 'openid mcp:read')`,
      [randomUUID(), clientA, userId],
    );
    await addRefresh(userId, clientB);
    await addRefresh(otherId, clientA);

    const clients = await listOAuthClients({ userId });
    expect(clients.map((c) => c.clientId).sort()).toEqual([clientA, clientB].sort());
    expect(clients.find((c) => c.clientId === clientA)).toMatchObject({
      name: 'Client A',
      scopes: ['openid', 'mcp:read'],
    });

    const others = await listOAuthClients({ userId: otherId });
    expect(others.map((c) => c.clientId)).toEqual([clientA]);
  });

  it('revokes one client for the user only, then 404s on a repeat', async () => {
    await revokeOAuthClient({ userId, clientId: clientA });

    const clients = await listOAuthClients({ userId });
    expect(clients.map((c) => c.clientId)).toEqual([clientB]);
    expect((await listOAuthClients({ userId: otherId })).map((c) => c.clientId)).toEqual([clientA]);

    await expect(revokeOAuthClient({ userId, clientId: clientA })).rejects.toThrow(/not found/i);
  });

  it('marks refresh tokens revoked so they drop out of the list', async () => {
    await revokeOAuthClient({ userId, clientId: clientB });
    expect(await listOAuthClients({ userId })).toEqual([]);
    const { rows } = await pool.query(
      `SELECT revoked FROM "oauthRefreshToken" WHERE "clientId" = $1 AND "userId" = $2`,
      [clientB, userId],
    );
    expect(rows[0].revoked).not.toBeNull();
  });
});
