import { pool } from '@hominem/db/core';
import { FINANCE_TRANSACTION_ENTITY_TYPE } from '@hominem/finance-services';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { requestIdMiddleware, type AppContext, type RpcUser } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { validationErrorMiddleware } from '../middleware/validation';
import { transactionsRoutes } from './finance.transactions';

const mainUserId = 'b4000001-0000-4000-8000-000000000001';
const filterUserId = 'b4000001-0000-4000-8000-000000000002';
const emptyUserId = 'b4000001-0000-4000-8000-000000000003';
const otherUserId = 'b4000001-0000-4000-8000-000000000004';
const tieUserId = 'b4000001-0000-4000-8000-000000000005';

const owners = [mainUserId, filterUserId, emptyUserId, otherUserId, tieUserId];

const mainAccountId = 'b4000003-0000-4000-8000-000000000001';
const filterAccountAId = 'b4000003-0000-4000-8000-000000000002';
const filterAccountBId = 'b4000003-0000-4000-8000-000000000003';
const emptyAccountId = 'b4000003-0000-4000-8000-000000000004';
const otherAccountId = 'b4000003-0000-4000-8000-000000000005';
const tieAccountId = 'b4000003-0000-4000-8000-000000000006';
const foodTagId = 'b4000005-0000-4000-8000-000000000001';

const bulkId = (n: number) => `b4000004-0000-4000-8000-${String(n).padStart(12, '0')}`;
const filterTransactionId = (n: number) => `b4000006-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tieTransactionId = (n: number) => `b4000008-0000-4000-8000-${String(n).padStart(12, '0')}`;

const pageSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().uuid(),
      userId: z.string(),
      accountId: z.string().uuid(),
      amount: z.number(),
      description: z.string().nullable(),
      postedOn: z.string(),
      merchantName: z.string().nullable(),
      currencyCode: z.string(),
    }),
  ),
  filteredCount: z.number().int(),
  totalUserCount: z.number().int(),
  nextCursor: z.string().nullable(),
});

type Page = z.infer<typeof pageSchema>;

function makeUser(id: string): RpcUser {
  return {
    id,
    email: `${id}@test.dev`,
    name: 'Finance Paging Test User',
    emailVerified: true,
    image: null,
    isAdmin: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function createApp(userId: string) {
  return new Hono<AppContext>()
    .onError(apiErrorHandler)
    .use(requestIdMiddleware)
    .use(validationErrorMiddleware)
    .use('*', async (c, next) => {
      c.set('auth', { user: makeUser(userId), userId, credential: 'session', scopes: [] });
      await next();
    })
    .route('/api/finance/transactions', transactionsRoutes);
}

const mainApp = createApp(mainUserId);
const filterApp = createApp(filterUserId);
const emptyApp = createApp(emptyUserId);
const tieApp = createApp(tieUserId);

const listUrl = (params: Record<string, string | string[] | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) search.append(key, item);
  }
  const query = search.toString();
  return `/api/finance/transactions/list${query ? `?${query}` : ''}`;
};

async function readPage(
  app: Hono<AppContext>,
  params: Record<string, string | string[] | undefined> = {},
): Promise<Page> {
  const res = await app.request(listUrl(params));
  expect(res.status).toBe(200);
  return pageSchema.parse(await res.json());
}

/** Walks a list with `size` rows per page, returning the ids in order. */
async function walk(
  app: Hono<AppContext>,
  params: Record<string, string | string[] | undefined>,
  size: number,
): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 100; guard++) {
    const page = await readPage(app, {
      ...params,
      limit: String(size),
      cursor: cursor ?? undefined,
    });
    ids.push(...page.data.map((row) => row.id));
    if (!page.nextCursor) return ids;
    cursor = page.nextCursor;
  }
  throw new Error('paging did not finish');
}

function forgeCursor(cursor: string, patch: Record<string, unknown>): string {
  const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  return Buffer.from(JSON.stringify({ ...payload, ...patch }), 'utf8').toString('base64url');
}

async function firstCursor(
  app: Hono<AppContext>,
  params: Record<string, string | string[] | undefined> = {},
): Promise<string> {
  const page = await readPage(app, { ...params, limit: '1' });
  if (!page.nextCursor) throw new Error('expected a cursor');
  return page.nextCursor;
}

async function removeUsers(ids: string[]) {
  await pool.query(
    `DELETE FROM app.tag_assignments WHERE tag_id IN (SELECT id FROM app.tags WHERE owner_userid = ANY($1))`,
    [ids],
  );
  await pool.query(`DELETE FROM app.tags WHERE owner_userid = ANY($1)`, [ids]);
  await pool.query(`DELETE FROM app.finance_transactions WHERE user_id = ANY($1)`, [ids]);
  await pool.query(`DELETE FROM app.finance_accounts WHERE user_id = ANY($1)`, [ids]);
  await pool.query('DELETE FROM "user" WHERE id = ANY($1)', [ids]);
}

async function insertAccount(id: string, owner: string, name: string) {
  await pool.query(
    `INSERT INTO app.finance_accounts (id, user_id, name, account_type, currency_code)
     VALUES ($1, $2, $3, 'checking', 'USD')`,
    [id, owner, name],
  );
}

interface TransactionRow {
  id: string;
  owner: string;
  accountId: string;
  postedOn: string;
  description: string;
  amount: number;
}

async function insertTransaction(row: TransactionRow) {
  await pool.query(
    `INSERT INTO app.finance_transactions
       (id, user_id, account_id, amount, transaction_type, description, posted_on,
        currency_code, source, external_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'USD', 'test', $8)`,
    [
      row.id,
      row.owner,
      row.accountId,
      row.amount,
      row.amount < 0 ? 'debit' : 'credit',
      row.description,
      row.postedOn,
      row.id,
    ],
  );
}

// The main walk: 50 rows share a posted date (so `id` is the only thing that can order them) and
// five are older, which puts them on the last page at the default and maximum limits.
const bulkRows: TransactionRow[] = Array.from({ length: 55 }, (_, index) => {
  const n = index + 1;
  return {
    id: bulkId(n),
    owner: mainUserId,
    accountId: mainAccountId,
    postedOn: n <= 50 ? '2026-03-01' : '2026-02-01',
    description: `bulk-${n}`,
    amount: -n,
  };
});

// Newest first by posted date, `id` breaking ties: 04-01 rows are r4 then r3.
const filterRows: TransactionRow[] = [
  {
    id: filterTransactionId(1),
    owner: filterUserId,
    accountId: filterAccountAId,
    postedOn: '2026-05-01',
    description: 'Groceries',
    amount: -30,
  },
  {
    id: filterTransactionId(2),
    owner: filterUserId,
    accountId: filterAccountBId,
    postedOn: '2026-04-15',
    description: 'Groceries again',
    amount: -10,
  },
  {
    id: filterTransactionId(3),
    owner: filterUserId,
    accountId: filterAccountAId,
    postedOn: '2026-04-01',
    description: 'Rent',
    amount: -900,
  },
  {
    id: filterTransactionId(4),
    owner: filterUserId,
    accountId: filterAccountAId,
    postedOn: '2026-04-01',
    description: 'Salary',
    amount: 2000,
  },
];

const otherRows: TransactionRow[] = [
  {
    id: 'b4000007-0000-4000-8000-000000000001',
    owner: otherUserId,
    accountId: otherAccountId,
    postedOn: '2026-06-01',
    description: 'Not mine',
    amount: -5,
  },
  {
    id: 'b4000007-0000-4000-8000-000000000002',
    owner: otherUserId,
    accountId: otherAccountId,
    postedOn: '2026-06-02',
    description: 'Also not mine',
    amount: -6,
  },
];

const tieRows: TransactionRow[] = [
  {
    id: tieTransactionId(1),
    owner: tieUserId,
    accountId: tieAccountId,
    postedOn: '2026-03-01',
    description: 'Coffee',
    amount: -3,
  },
  {
    id: tieTransactionId(2),
    owner: tieUserId,
    accountId: tieAccountId,
    postedOn: '2026-03-01',
    description: 'Coffee Shop',
    amount: -4,
  },
  {
    id: tieTransactionId(3),
    owner: tieUserId,
    accountId: tieAccountId,
    postedOn: '2026-03-01',
    description: 'Coffee',
    amount: -5,
  },
  // Equal *fractional* similarity (~0.7): this is the case where a `real` score round-tripped
  // through a JavaScript number could disagree with itself and repeat or skip rows mid-walk.
  ...[1, 2, 3, 4].map((n) => ({
    id: tieTransactionId(3 + n),
    owner: tieUserId,
    accountId: tieAccountId,
    postedOn: '2026-03-01',
    description: `Coffee ${n}`,
    amount: -6 - n,
  })),
];

beforeAll(async () => {
  await removeUsers(owners);
  for (const id of owners) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true)`,
      [id, 'Finance Paging Test User', `${id}@test.dev`],
    );
  }

  await insertAccount(mainAccountId, mainUserId, 'Main Checking');
  await insertAccount(filterAccountAId, filterUserId, 'Filter Checking');
  await insertAccount(filterAccountBId, filterUserId, 'Filter Card');
  await insertAccount(emptyAccountId, emptyUserId, 'Empty Checking');
  await insertAccount(otherAccountId, otherUserId, 'Other Checking');
  await insertAccount(tieAccountId, tieUserId, 'Tie Checking');

  for (const row of [...bulkRows, ...filterRows, ...otherRows, ...tieRows]) {
    await insertTransaction(row);
  }

  await pool.query(
    `INSERT INTO app.tags (id, owner_userid, name, path, slug) VALUES ($1, $2, 'Food', 'Food', 'food')`,
    [foodTagId, filterUserId],
  );
  for (const row of filterRows.slice(0, 2)) {
    await pool.query(
      `INSERT INTO app.tag_assignments (tag_id, entity_table, entity_id)
       VALUES ($1, '${FINANCE_TRANSACTION_ENTITY_TYPE}'::regclass, $2)`,
      [foodTagId, row.id],
    );
  }
});

afterAll(async () => {
  await removeUsers(owners);
});

describe('finance transaction list paging', () => {
  it('defaults to 20 rows and caps a page at 50', async () => {
    const defaults = await readPage(mainApp);
    expect(defaults.data).toHaveLength(20);
    expect(defaults.data.map((row) => row.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => bulkId(50 - index)),
    );
    expect(defaults.filteredCount).toBe(55);
    expect(defaults.totalUserCount).toBe(55);
    expect(defaults.nextCursor).not.toBeNull();

    const capped = await readPage(mainApp, { limit: '50' });
    expect(capped.data).toHaveLength(50);
    expect(capped.data[0]?.id).toBe(bulkId(50));
    expect(capped.nextCursor).not.toBeNull();

    const final = await readPage(mainApp, { limit: '50', cursor: capped.nextCursor ?? '' });
    expect(final.data.map((row) => row.id)).toEqual(
      Array.from({ length: 5 }, (_, index) => bulkId(55 - index)),
    );
    expect(final.nextCursor).toBeNull();
  });

  it('rejects limits outside 1-50', async () => {
    for (const limit of ['0', '51', 'abc', '-1']) {
      expect((await mainApp.request(listUrl({ limit }))).status).toBe(400);
    }
    expect((await mainApp.request(listUrl({ limit: '50' }))).status).toBe(200);
  });

  it('walks every page with no repeats or gaps', async () => {
    const expected = [
      ...Array.from({ length: 50 }, (_, index) => bulkId(50 - index)),
      ...Array.from({ length: 5 }, (_, index) => bulkId(55 - index)),
    ];
    for (const size of [1, 2, 7, 20, 50]) {
      const walked = await walk(mainApp, {}, size);
      expect(walked).toHaveLength(55);
      expect(new Set(walked).size).toBe(55);
      expect(walked).toEqual(expected);
    }
  });

  it('returns an empty first page with no cursor', async () => {
    const page = await readPage(emptyApp);
    expect(page.data).toEqual([]);
    expect(page.filteredCount).toBe(0);
    expect(page.totalUserCount).toBe(0);
    expect(page.nextCursor).toBeNull();
  });

  it('keeps the response fields and owner scoping intact', async () => {
    const page = await readPage(mainApp, { limit: '1' });
    expect(Object.keys(page.data[0] ?? {}).sort()).toEqual([
      'accountId',
      'amount',
      'currencyCode',
      'description',
      'id',
      'merchantName',
      'postedOn',
      'userId',
    ]);
    expect(page.data[0]).toMatchObject({ userId: mainUserId, accountId: mainAccountId });

    const seen = await walk(mainApp, {}, 10);
    for (const row of otherRows) expect(seen).not.toContain(row.id);
  });

  it('does not repeat or skip rows when one is inserted between pages', async () => {
    const first = await readPage(mainApp, { limit: '1' });
    expect(first.data.map((row) => row.id)).toEqual([bulkId(50)]);
    const cursor = first.nextCursor;
    if (!cursor) throw new Error('expected a cursor');

    // Sorts before the cursor (same date, higher id): the ongoing walk must not see it.
    await insertTransaction({
      id: bulkId(99),
      owner: mainUserId,
      accountId: mainAccountId,
      postedOn: '2026-03-01',
      description: 'inserted-newer',
      amount: -1,
    });
    // Sorts after the cursor (same date, lower id): it must appear exactly once.
    await insertTransaction({
      id: bulkId(0),
      owner: mainUserId,
      accountId: mainAccountId,
      postedOn: '2026-03-01',
      description: 'inserted-older',
      amount: -1,
    });

    const rest: string[] = [];
    let next: string | null = cursor;
    for (let guard = 0; next && guard < 60; guard++) {
      const page: Page = await readPage(mainApp, { limit: '10', cursor: next });
      rest.push(...page.data.map((row) => row.id));
      next = page.nextCursor;
    }
    const walked = [bulkId(50), ...rest];

    expect(walked).not.toContain(bulkId(99));
    expect(walked.filter((id) => id === bulkId(0))).toHaveLength(1);
    expect(new Set(walked).size).toBe(walked.length);

    await pool.query(`DELETE FROM app.finance_transactions WHERE id = ANY($1)`, [
      [bulkId(99), bulkId(0)],
    ]);
  });

  it('preserves the account, date, amount, tag and text filters', async () => {
    const byAccount = await readPage(filterApp, { account: filterAccountBId });
    expect(byAccount.data.map((row) => row.id)).toEqual([filterTransactionId(2)]);

    const byAccountIds = await readPage(filterApp, {
      accountIds: [filterAccountAId, filterAccountBId],
    });
    expect(byAccountIds.data.map((row) => row.id)).toEqual([
      filterTransactionId(1),
      filterTransactionId(2),
      filterTransactionId(4),
      filterTransactionId(3),
    ]);

    const byDate = await readPage(filterApp, { dateFrom: '2026-04-01', dateTo: '2026-04-15' });
    expect(byDate.data.map((row) => row.id)).toEqual([
      filterTransactionId(2),
      filterTransactionId(4),
      filterTransactionId(3),
    ]);

    const byAmount = await readPage(filterApp, { min: '100' });
    expect(byAmount.data.map((row) => row.id)).toEqual([
      filterTransactionId(4),
      filterTransactionId(3),
    ]);

    const byTagName = await readPage(filterApp, { tagNames: 'Food' });
    expect(byTagName.data.map((row) => row.id)).toEqual([
      filterTransactionId(1),
      filterTransactionId(2),
    ]);
    expect(byTagName.filteredCount).toBe(2);
    expect(byTagName.totalUserCount).toBe(4);

    const byTagId = await readPage(filterApp, { tagIds: foodTagId });
    expect(byTagId.data.map((row) => row.id)).toEqual([
      filterTransactionId(1),
      filterTransactionId(2),
    ]);

    const byText = await readPage(filterApp, { description: 'grocer' });
    expect(byText.data.map((row) => row.id).sort()).toEqual([
      filterTransactionId(1),
      filterTransactionId(2),
    ]);
  });

  it('keeps a stable order when text ranking ties', async () => {
    const whole = await readPage(tieApp, { description: 'coffee', limit: '50' });
    // Exact matches first, then the four equal fractional scores, each group ordered by `id` desc;
    // the partial match ranks below them all.
    expect(whole.data.map((row) => row.id)).toEqual([
      tieTransactionId(3),
      tieTransactionId(1),
      tieTransactionId(7),
      tieTransactionId(6),
      tieTransactionId(5),
      tieTransactionId(4),
      tieTransactionId(2),
    ]);
    // Page sizes that cut through the tied fractional group must neither repeat nor skip a row.
    for (const size of [1, 2, 3, 4]) {
      expect(await walk(tieApp, { description: 'coffee' }, size)).toEqual(
        whole.data.map((row) => row.id),
      );
    }
    const rerun = await readPage(tieApp, { description: 'coffee', limit: '50' });
    expect(rerun.data.map((row) => row.id)).toEqual(whole.data.map((row) => row.id));
  });

  it('rejects malformed cursors', async () => {
    const real = await firstCursor(mainApp);
    const malformed = [
      'not-a-cursor',
      Buffer.from('null', 'utf8').toString('base64url'),
      Buffer.from('[]', 'utf8').toString('base64url'),
      forgeCursor(real, { k: [0, '2026-03-01'] }),
      forgeCursor(real, { k: [0, '2026-02-31', bulkId(50)] }),
      forgeCursor(real, { k: [0, '2026-03-01', 'not-a-uuid'] }),
      forgeCursor(real, { k: ['zero', '2026-03-01', bulkId(50)] }),
    ];
    for (const cursor of malformed) {
      const res = await mainApp.request(listUrl({ cursor }));
      expect(res.status).toBe(400);
      if (cursor === 'not-a-cursor') {
        await expect(res.json()).resolves.toMatchObject({
          error: 'validation_error',
          code: 'VALIDATION_ERROR',
          details: { cursor },
        });
      }
    }
  });

  it('rejects a cursor issued for another endpoint', async () => {
    const real = await firstCursor(mainApp);
    const careerCursor = forgeCursor(real, { r: 'career.skills' });
    expect((await mainApp.request(listUrl({ cursor: careerCursor }))).status).toBe(400);
    expect((await mainApp.request(listUrl({ cursor: real }))).status).toBe(200);
  });

  it('rejects a cursor replayed against a different filter', async () => {
    const accountCursor = await firstCursor(filterApp, { account: filterAccountAId });
    expect(
      (await filterApp.request(listUrl({ account: filterAccountBId, cursor: accountCursor })))
        .status,
    ).toBe(400);
    expect((await filterApp.request(listUrl({ cursor: accountCursor }))).status).toBe(400);
    const resumed = await filterApp.request(
      listUrl({ account: filterAccountAId, limit: '1', cursor: accountCursor }),
    );
    expect(resumed.status).toBe(200);
    await expect(resumed.json()).resolves.toMatchObject({
      data: [{ id: filterTransactionId(4) }],
    });

    const taggedCursor = await firstCursor(filterApp, { tagNames: 'Food' });
    expect((await filterApp.request(listUrl({ cursor: taggedCursor }))).status).toBe(400);

    const textCursor = await firstCursor(filterApp, { description: 'grocer' });
    expect(
      (await filterApp.request(listUrl({ description: 'rent', cursor: textCursor }))).status,
    ).toBe(400);
  });
});
