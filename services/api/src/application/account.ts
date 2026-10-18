/**
 * Download and delete a person's whole account. Both find the person's rows by asking the database
 * which columns point at the user table, so a table added later is covered without an edit here.
 * Deleting relies on those foreign keys cascading; the one that does not is cleared by hand.
 */
import { authDb, db, sql } from '@hominem/db/core';

// Raw catalogue and row queries use `authDb`: it does not rewrite column names, so a downloaded row
// keeps the names it has in the database.

/** Tables that hold secrets or machine data: left out of the download, never useful to read. */
const EXPORT_SKIP = new Set([
  'session',
  'account',
  'passkey',
  'deviceCode',
  'jwks',
  'app.mcp_tokens',
  'app.provider_credentials',
  'app.credential_blocks',
  'app.vector_documents',
]);

const LEGACY_SUFFIX = /_legacy_\d+$/;

type Reference = { table: string; column: string };

/** Every table.column that holds a user id, from the database's own foreign keys. */
async function userReferences(): Promise<Reference[]> {
  const { rows } = await sql<{ table: string; column: string }>`
    select c.conrelid::regclass::text as "table", a.attname as "column"
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'public."user"'::regclass
    order by 1, 2
  `.execute(authDb);
  return rows.map(({ table, column }) => ({ table, column }));
}

function skipped(table: string): boolean {
  const bare = table.replaceAll('"', '');
  return EXPORT_SKIP.has(bare) || LEGACY_SUFFIX.test(bare) || bare.startsWith('oauth');
}

export type AccountExport = {
  exportedAt: string;
  user: Record<string, unknown> | null;
  /** Rows by table name, as stored. */
  data: Record<string, Record<string, unknown>[]>;
};

/** Everything the server keeps about this person, as plain JSON. */
export async function exportAccount(userId: string, now = new Date()): Promise<AccountExport> {
  const user = await sql<{ row: Record<string, unknown> }>`
    select to_jsonb(u) - 'image' as row from public."user" u where id = ${userId}
  `.execute(authDb);
  const data: AccountExport['data'] = {};
  for (const { table, column } of await userReferences()) {
    if (skipped(table)) continue;
    // Table and column names come from the catalogue above, never from the request.
    const found = await sql<{ row: Record<string, unknown> }>`
      select to_jsonb(t) as row from ${sql.raw(table)} t where t.${sql.ref(column)} = ${userId}
    `.execute(authDb);
    const name = table.replaceAll('"', '');
    // A table can point at the user twice (a collection's owner and a member): keep both sets.
    if (found.rows.length > 0)
      data[name] = [...(data[name] ?? []), ...found.rows.map((r) => r.row)];
  }
  return { exportedAt: now.toISOString(), user: user.rows[0]?.row ?? null, data };
}

export type DeleteAccountDeps = {
  /** Ends the person's provider keys so nothing can spend after the account is gone. */
  endKeys: (userId: string) => Promise<void>;
  /** Removes one stored file's object from storage. */
  removeStoredFile: (fileId: string, userId: string) => Promise<void>;
};

/**
 * Deletes the account. Order matters: keys first (money), then stored files (they cannot be listed
 * once the rows are gone), then the user row, which cascades to everything else.
 */
export async function deleteAccount(userId: string, deps: DeleteAccountDeps): Promise<void> {
  await deps.endKeys(userId);
  const files = await db
    .selectFrom('app.files')
    .select('id')
    .where('ownerUserid', '=', userId)
    .execute();
  for (const file of files) await deps.removeStoredFile(file.id, userId);
  await authDb.transaction().execute(async (trx) => {
    // This foreign key does not cascade, so it would block the delete.
    await sql`delete from "oauthRefreshToken" where "userId" = ${userId}`.execute(trx);
    await sql`delete from public."user" where id = ${userId}`.execute(trx);
  });
}

export type CreditEntry = { kind: 'grant' | 'topup'; amountPence: number; at: string };

/** Free credit and top-ups, newest first, so the account page can show where the balance came from. */
export async function creditHistory(userId: string, limit = 20): Promise<CreditEntry[]> {
  const rows = await db
    .selectFrom('app.creditLedger')
    .select(['kind', 'amountPence', 'createdAt'])
    .where('userId', '=', userId)
    .where('kind', 'in', ['grant', 'topup'])
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .execute();
  return rows.map((row) => ({
    kind: row.kind === 'grant' ? 'grant' : 'topup',
    amountPence: row.amountPence,
    at: String(row.createdAt),
  }));
}
