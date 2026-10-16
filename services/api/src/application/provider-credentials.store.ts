import { db, runInTransaction } from '@hominem/db/core';

import type { CredentialRow, CredentialStore } from './provider-credentials';

function toDate(value: string | Date | null): Date | null {
  return value === null ? null : new Date(value);
}

/** The database side of the credential rules. Server-only tables: no owner policy. */
export const dbCredentialStore: CredentialStore = {
  async isBlocked(userId) {
    const row = await db
      .selectFrom('app.credentialBlocks')
      .select('userId')
      .where('userId', '=', userId)
      .executeTakeFirst();
    return row !== undefined;
  },

  async isAllowed(email) {
    const row = await db
      .selectFrom('app.credentialAllowedEmails')
      .select('email')
      .where('email', '=', email)
      .executeTakeFirst();
    return row !== undefined;
  },

  async rows(userId) {
    const rows = await db
      .selectFrom('app.providerCredentials')
      .selectAll()
      .where('userId', '=', userId)
      .orderBy('createdAt', 'asc')
      .execute();
    return rows.map((row): CredentialRow => ({
      id: row.id,
      userId: row.userId,
      deviceId: row.deviceId,
      keyHash: row.keyHash,
      period: row.period,
      limitUsd: Number(row.limitUsd),
      createdAt: new Date(row.createdAt),
      revokedAt: toDate(row.revokedAt),
      disabledAt: toDate(row.disabledAt),
    }));
  },

  async replace({ revokeHashes, insert, at }) {
    await runInTransaction(async (trx) => {
      if (revokeHashes.length > 0) {
        await trx
          .updateTable('app.providerCredentials')
          .set({ revokedAt: at })
          .where('keyHash', 'in', revokeHashes)
          .where('revokedAt', 'is', null)
          .execute();
      }
      await trx
        .insertInto('app.providerCredentials')
        .values({
          userId: insert.userId,
          deviceId: insert.deviceId,
          keyHash: insert.keyHash,
          period: insert.period,
          limitUsd: insert.limitUsd,
          createdAt: insert.createdAt,
        })
        .execute();
    });
  },

  async markRevoked(keyHash, at) {
    await db
      .updateTable('app.providerCredentials')
      .set({ revokedAt: at })
      .where('keyHash', '=', keyHash)
      .where('revokedAt', 'is', null)
      .execute();
  },

  async markDisabled(keyHash, at) {
    await db
      .updateTable('app.providerCredentials')
      .set({ disabledAt: at })
      .where('keyHash', '=', keyHash)
      .execute();
  },
};

export async function allowEmail(email: string): Promise<void> {
  await db
    .insertInto('app.credentialAllowedEmails')
    .values({ email: email.trim().toLowerCase() })
    .onConflict((conflict) => conflict.doNothing())
    .execute();
}

export async function disallowEmail(email: string): Promise<void> {
  await db
    .deleteFrom('app.credentialAllowedEmails')
    .where('email', '=', email.trim().toLowerCase())
    .execute();
}

export async function blockUser(userId: string): Promise<void> {
  await db
    .insertInto('app.credentialBlocks')
    .values({ userId })
    .onConflict((conflict) => conflict.doNothing())
    .execute();
}

export async function unblockUser(userId: string): Promise<void> {
  await db.deleteFrom('app.credentialBlocks').where('userId', '=', userId).execute();
}
