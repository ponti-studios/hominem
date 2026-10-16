import { db, pool } from '@hominem/db/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  allowEmail,
  blockUser,
  dbCredentialStore,
  disallowEmail,
  unblockUser,
} from './provider-credentials.store';

const userId = 'd4000000-0000-4000-8000-000000000021';
const email = 'store-test@work.hominem.dev';

async function clean() {
  await pool.query(`DELETE FROM app.provider_credentials WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM app.credential_blocks WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM app.credential_allowed_emails WHERE email = $1`, [email]);
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
}

beforeAll(async () => {
  await clean();
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)`,
    [userId, 'Credential Store Test User', email, true],
  );
});

afterAll(async () => {
  await clean();
  await pool.end();
});

describe('dbCredentialStore', () => {
  it('knows the allow-list, case-insensitively through the caller', async () => {
    expect(await dbCredentialStore.isAllowed(email)).toBe(false);
    await allowEmail(email.toUpperCase());
    expect(await dbCredentialStore.isAllowed(email)).toBe(true);
    await disallowEmail(email);
    expect(await dbCredentialStore.isAllowed(email)).toBe(false);
  });

  it('blocks and unblocks a person', async () => {
    expect(await dbCredentialStore.isBlocked(userId)).toBe(false);
    await blockUser(userId);
    await blockUser(userId);
    expect(await dbCredentialStore.isBlocked(userId)).toBe(true);
    await unblockUser(userId);
    expect(await dbCredentialStore.isBlocked(userId)).toBe(false);
  });

  it('replaces a device key in one step and allows only one live key per device', async () => {
    const at = new Date('2026-10-16T12:00:00Z');
    const first = {
      userId,
      deviceId: 'device-aaaaaaaa',
      keyHash: 'hash-store-1',
      period: '2026-10',
      limitUsd: 1.6666,
      createdAt: at,
    };
    await dbCredentialStore.replace({ revokeHashes: [], insert: first, at });
    // A second live key for the same device is refused by the database itself.
    await expect(
      dbCredentialStore.replace({
        revokeHashes: [],
        insert: { ...first, keyHash: 'hash-store-x' },
        at,
      }),
    ).rejects.toThrow();
    // Replacing ends the old row and adds the new one together.
    await dbCredentialStore.replace({
      revokeHashes: ['hash-store-1'],
      insert: { ...first, keyHash: 'hash-store-2' },
      at,
    });
    const rows = await dbCredentialStore.rows(userId);
    expect(rows.map((row) => [row.keyHash, row.revokedAt !== null, row.limitUsd])).toEqual([
      ['hash-store-1', true, 1.6666],
      ['hash-store-2', false, 1.6666],
    ]);
    await dbCredentialStore.markDisabled('hash-store-1', at);
    expect((await dbCredentialStore.rows(userId))[0]?.disabledAt).not.toBeNull();
    await db.deleteFrom('app.providerCredentials').where('userId', '=', userId).execute();
  });
});
