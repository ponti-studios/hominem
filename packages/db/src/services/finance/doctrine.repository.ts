import { sql } from 'kysely';

import type { DbHandle } from '../../transaction';

/** The active ingest doctrine for a user — one row, replaced wholesale on import. */
export type SyncDoctrineRecord = {
  fingerprint: string;
  contents: unknown;
  updatedAt: string;
};

export const FinanceDoctrineRepository = {
  async findLatest(handle: DbHandle, userId: string): Promise<SyncDoctrineRecord | null> {
    const row = await handle
      .selectFrom('app.financeSyncDoctrine')
      .select(['fingerprint', 'contents', 'updatedAt'])
      .where('userId', '=', userId)
      .executeTakeFirst();
    return row
      ? { fingerprint: row.fingerprint, contents: row.contents, updatedAt: row.updatedAt }
      : null;
  },
  async upsert(
    handle: DbHandle,
    userId: string,
    fingerprint: string,
    contents: unknown,
  ): Promise<Omit<SyncDoctrineRecord, 'contents'>> {
    const row = await handle
      .insertInto('app.financeSyncDoctrine')
      .values({
        userId,
        fingerprint,
        contents: sql`${JSON.stringify(contents)}::jsonb`,
      })
      .onConflict((conflict) =>
        conflict.column('userId').doUpdateSet({
          fingerprint,
          contents: sql`${JSON.stringify(contents)}::jsonb`,
          updatedAt: sql`now()`,
        }),
      )
      .returning(['fingerprint', 'updatedAt'])
      .executeTakeFirstOrThrow();
    return { fingerprint: row.fingerprint, updatedAt: row.updatedAt };
  },
};
