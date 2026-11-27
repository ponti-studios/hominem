import {
  removeTransactions,
  removeUsers,
  resetUsers,
  seedAccounts,
  seedTag,
  seedTagAssignments,
  seedTransaction,
  seedTransactions,
} from '@hominem/finance-services/test/factory';
import { transactionsByIds } from '@hominem/finance-services/test/readers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  firstCursor,
  forgeCursor,
  listUrl,
  readPage,
  walk,
  type Page,
} from '../../testkit/fixtures/finance-paging';
import { financeTestApp } from '../../testkit/fixtures/finance-rpc';
import { transactionsRoutes } from './finance.transactions';

type TransactionSeed = Omit<Parameters<typeof seedTransaction>[0], 'userId'> & { id: string };

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

const mainApp = financeTestApp('transactions', transactionsRoutes, mainUserId);
const filterApp = financeTestApp('transactions', transactionsRoutes, filterUserId);
const emptyApp = financeTestApp('transactions', transactionsRoutes, emptyUserId);
const tieApp = financeTestApp('transactions', transactionsRoutes, tieUserId);

// The main walk: 50 rows share a posted date (so `id` is the only thing that can order them) and
// five are older, which puts them on the last page at the default and maximum limits.
const bulkRows: TransactionSeed[] = Array.from({ length: 55 }, (_, index) => {
  const n = index + 1;
  return {
    id: bulkId(n),
    accountId: mainAccountId,
    postedOn: n <= 50 ? '2026-03-01' : '2026-02-01',
    description: `bulk-${n}`,
    amount: -n,
  };
});

// Newest first by posted date, `id` breaking ties: 04-01 rows are r4 then r3.
const filterRows: TransactionSeed[] = [
  {
    id: filterTransactionId(1),
    accountId: filterAccountAId,
    postedOn: '2026-05-01',
    description: 'Groceries',
    amount: -30,
  },
  {
    id: filterTransactionId(2),
    accountId: filterAccountBId,
    postedOn: '2026-04-15',
    description: 'Groceries again',
    amount: -10,
  },
  {
    id: filterTransactionId(3),
    accountId: filterAccountAId,
    postedOn: '2026-04-01',
    description: 'Rent',
    amount: -900,
  },
  {
    id: filterTransactionId(4),
    accountId: filterAccountAId,
    postedOn: '2026-04-01',
    description: 'Salary',
    amount: 2000,
  },
];

const otherRows: TransactionSeed[] = [
  {
    id: 'b4000007-0000-4000-8000-000000000001',
    accountId: otherAccountId,
    postedOn: '2026-06-01',
    description: 'Not mine',
    amount: -5,
  },
  {
    id: 'b4000007-0000-4000-8000-000000000002',
    accountId: otherAccountId,
    postedOn: '2026-06-02',
    description: 'Also not mine',
    amount: -6,
  },
];

const tieRows: TransactionSeed[] = [
  {
    id: tieTransactionId(1),
    accountId: tieAccountId,
    postedOn: '2026-03-01',
    description: 'Coffee',
    amount: -3,
  },
  {
    id: tieTransactionId(2),
    accountId: tieAccountId,
    postedOn: '2026-03-01',
    description: 'Coffee Shop',
    amount: -4,
  },
  {
    id: tieTransactionId(3),
    accountId: tieAccountId,
    postedOn: '2026-03-01',
    description: 'Coffee',
    amount: -5,
  },
  // Equal *fractional* similarity (~0.7): this is the case where a `real` score round-tripped
  // through a JavaScript number could disagree with itself and repeat or skip rows mid-walk.
  ...[1, 2, 3, 4].map((n) => ({
    id: tieTransactionId(3 + n),
    accountId: tieAccountId,
    postedOn: '2026-03-01',
    description: `Coffee ${n}`,
    amount: -6 - n,
  })),
];

beforeAll(async () => {
  await resetUsers(...owners);
  await seedAccounts(mainUserId, [
    { id: mainAccountId, name: 'Main Checking' },
    { id: filterAccountAId, userId: filterUserId, name: 'Filter Checking' },
    { id: filterAccountBId, userId: filterUserId, name: 'Filter Card' },
    { id: emptyAccountId, userId: emptyUserId, name: 'Empty Checking' },
    { id: otherAccountId, userId: otherUserId, name: 'Other Checking' },
    { id: tieAccountId, userId: tieUserId, name: 'Tie Checking' },
  ]);
  await seedTransactions(mainUserId, bulkRows);
  await seedTransactions(filterUserId, filterRows);
  await seedTransactions(otherUserId, otherRows);
  await seedTransactions(tieUserId, tieRows);

  await seedTag({
    id: foodTagId,
    ownerUserid: filterUserId,
    name: 'Food',
    path: 'Food',
    slug: 'food',
  });
  await seedTagAssignments(
    foodTagId,
    filterRows.slice(0, 2).map((row) => row.id),
  );
});

afterAll(() => removeUsers(...owners));

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
      'accountName',
      'amount',
      'categoryId',
      'categoryName',
      'counterpartId',
      'currencyCode',
      'description',
      'excluded',
      'id',
      'merchantName',
      'notes',
      'pending',
      'postedOn',
      'recurring',
      'source',
      'tags',
      'transactionType',
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
    await seedTransaction({
      userId: mainUserId,
      id: bulkId(99),
      accountId: mainAccountId,
      postedOn: '2026-03-01',
      description: 'inserted-newer',
      amount: -1,
    });
    // Sorts after the cursor (same date, lower id): it must appear exactly once.
    await seedTransaction({
      userId: mainUserId,
      id: bulkId(0),
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

    await removeTransactions(bulkId(99), bulkId(0));
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

  it('filters an explicit set of transaction ids and fingerprints it into the cursor', async () => {
    const page = await readPage(mainApp, { transactionIds: [bulkId(1), bulkId(3)], limit: '1' });
    expect(page.data.map((row) => row.id)).toEqual([bulkId(3)]);
    expect(page.filteredCount).toBe(2);
    expect(page.nextCursor).not.toBeNull();
    const next = await readPage(mainApp, {
      transactionIds: [bulkId(1), bulkId(3)],
      limit: '1',
      cursor: page.nextCursor ?? '',
    });
    expect(next.data.map((row) => row.id)).toEqual([bulkId(1)]);
    expect(next.nextCursor).toBeNull();
    expect(
      (
        await mainApp.request(
          listUrl({ transactionIds: [bulkId(1)], cursor: page.nextCursor ?? '' }),
        )
      ).status,
    ).toBe(400);
  });

  it('rejects bulk changes to another owner’s transaction', async () => {
    const response = await mainApp.request('/api/finance/transactions/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [otherRows[0]!.id], action: { action: 'exclude' } }),
    });
    expect(response.status).toBe(400);
    const [stored] = await transactionsByIds([otherRows[0]!.id]);
    expect(stored?.excluded).toBe(false);
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
