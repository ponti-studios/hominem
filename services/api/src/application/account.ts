/**
 * Download and delete a person's whole account. The download finds the person's rows by asking the
 * database which columns point at the user table, and which tables point at those rows in turn, so a
 * table added later is covered without an edit here. Deleting relies on the foreign keys cascading;
 * the one that does not is cleared by hand.
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

type Edge = {
  child: string;
  childColumn: string;
  parent: string;
  parentColumn: string;
  toUser: boolean;
};

/** Every single-column foreign key in the database: which table points at which. */
async function foreignKeys(): Promise<Edge[]> {
  const { rows } = await sql<{
    child: string;
    childColumn: string;
    parent: string;
    parentColumn: string;
    toUser: boolean;
  }>`
    select c.conrelid::regclass::text as "child", ca.attname as "childColumn",
           c.confrelid::regclass::text as "parent", pa.attname as "parentColumn",
           c.confrelid = 'public."user"'::regclass as "toUser"
    from pg_constraint c
    join pg_attribute ca on ca.attrelid = c.conrelid and ca.attnum = c.conkey[1]
    join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1]
    where c.contype = 'f' and array_length(c.conkey, 1) = 1
    order by 1, 2
  `.execute(authDb);
  return rows;
}

/** A condition on a table, written for a given alias, that selects the rows this person owns. */
type Owned = (alias: string) => ReturnType<typeof sql>;

/** How far to follow "belongs to a row that belongs to ..." chains below the user table. */
const MAX_DEPTH = 4;

/**
 * Every table that holds this person's rows, directly (a user id column) or through a chain of
 * parents (a stage that belongs to an application that belongs to the person), each with the
 * condition that picks the person's rows.
 */
async function ownedTables(userId: string): Promise<{ table: string; owned: Owned }[]> {
  const edges = await foreignKeys();
  const found: { table: string; owned: Owned }[] = [];
  const seen = new Set<string>();
  let level: { table: string; owned: Owned }[] = [];
  for (const edge of edges.filter((e) => e.toUser && !skipped(e.child))) {
    const owned: Owned = (alias) => sql`${sql.ref(`${alias}.${edge.childColumn}`)} = ${userId}`;
    found.push({ table: edge.child, owned });
    level.push({ table: edge.child, owned });
    seen.add(`${edge.child}.${edge.childColumn}`);
  }
  for (let depth = 1; depth <= MAX_DEPTH && level.length > 0; depth++) {
    const next: typeof level = [];
    for (const parent of level) {
      for (const edge of edges.filter((e) => !e.toUser && e.parent === parent.table)) {
        const key = `${edge.child}.${edge.childColumn}`;
        if (skipped(edge.child) || seen.has(key) || edge.child === parent.table) continue;
        seen.add(key);
        // The parent's condition is written for its own alias, one level deeper each time.
        const parentAlias = `p${depth}`;
        const owned: Owned = (alias) => sql`${sql.ref(`${alias}.${edge.childColumn}`)} in (
          select ${sql.ref(`${parentAlias}.${edge.parentColumn}`)}
          from ${sql.raw(edge.parent)} ${sql.raw(parentAlias)}
          where ${parent.owned(parentAlias)})`;
        found.push({ table: edge.child, owned });
        next.push({ table: edge.child, owned });
      }
    }
    level = next;
  }
  return found;
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
  for (const { table, owned } of await ownedTables(userId)) {
    // Table and column names come from the catalogue above, never from the request.
    const found = await sql<{ row: Record<string, unknown> }>`
      select to_jsonb(t) as row from ${sql.raw(table)} t where ${owned('t')}
    `.execute(authDb);
    const name = table.replaceAll('"', '');
    // A table can be reached twice (a collection's owner and a member): keep both sets.
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
