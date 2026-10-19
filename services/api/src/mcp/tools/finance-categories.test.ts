import { db, pool, sql } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { callTool, type McpToolResult } from '../tool-registry';
import './finance';

const userId = 'f20000e0-0000-4000-8000-000000000001';
const otherUserId = 'f20000e0-0000-4000-8000-000000000002';
const checkingId = 'f20000e1-0000-4000-8000-000000000001';

type CategoryResult = {
  id?: string | null;
  name?: string;
  created?: boolean;
  deleted?: { id: string; name: string };
  dryRun?: boolean;
  transactionsReassigned?: number;
  category?: { id: string; name: string } | null;
  removedCategory?: { id: string; name: string } | null;
  reason?: string | null;
};

function content(res: McpToolResult<CategoryResult>): CategoryResult {
  return res.structuredContent ?? {};
}

async function categoryByName(owner: string, name: string) {
  return db
    .selectFrom('app.financeCategories')
    .select(['id', 'name'])
    .where('userId', '=', owner)
    .where(sql<boolean>`lower(name) = lower(${name})`)
    .executeTakeFirst();
}

beforeAll(async () => {
  for (const id of [userId, otherUserId]) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, `Category User ${id}`, `${id}@test.hominem.dev`, true],
    );
    await db.deleteFrom('app.financeAccounts').where('userId', '=', id).execute();
    await db.deleteFrom('app.financeCategories').where('userId', '=', id).execute();
  }

  await db
    .insertInto('app.financeAccounts')
    .values({
      id: checkingId,
      userId,
      name: 'Category Checking',
      accountType: 'checking',
      currencyCode: 'USD',
      lifecycleStatus: 'open',
      includeInNetWorth: true,
      metadata: {},
    })
    .execute();
});

describe('finance_category_create', () => {
  it('creates a category, then returns it on a case-insensitive re-create', async () => {
    const first = content(await callTool(userId, 'finance_category_create', { name: 'Groceries' }));
    expect(first.created).toBe(true);
    expect(first.id).toBeTruthy();

    const second = content(
      await callTool(userId, 'finance_category_create', { name: 'groceries' }),
    );
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);

    const rows = await db
      .selectFrom('app.financeCategories')
      .select('id')
      .where('userId', '=', userId)
      .where(sql<boolean>`lower(name) = 'groceries'`)
      .execute();
    expect(rows).toHaveLength(1);
  });

  it('dryRun reports the outcome without writing', async () => {
    const wouldCreate = content(
      await callTool(userId, 'finance_category_create', { name: 'Dry Run Cat', dryRun: true }),
    );
    expect(wouldCreate).toMatchObject({ created: true, id: null, dryRun: true });
    expect(await categoryByName(userId, 'Dry Run Cat')).toBeUndefined();
  });
});

describe('finance_category_merge', () => {
  it('reassigns transactions and removes the source category', async () => {
    const source = content(
      await callTool(userId, 'finance_category_create', { name: 'Merge Source' }),
    );
    const target = content(
      await callTool(userId, 'finance_category_create', { name: 'Merge Target' }),
    );

    await db
      .insertInto('app.financeTransactions')
      .values([
        {
          id: 'f20000e2-0000-4000-8000-000000000001',
          userId,
          accountId: checkingId,
          postedOn: '2026-06-01',
          description: 'Row one',
          amount: -1000,
          currencyCode: 'USD',
          transactionType: 'debit',
          pending: false,
          categoryId: source.id ?? '',
          excluded: false,
          externalId: 'cat-ext-1',
          providerPayload: {},
        },
        {
          id: 'f20000e2-0000-4000-8000-000000000002',
          userId,
          accountId: checkingId,
          postedOn: '2026-06-02',
          description: 'Row two',
          amount: -2000,
          currencyCode: 'USD',
          transactionType: 'debit',
          pending: false,
          categoryId: source.id ?? '',
          excluded: false,
          externalId: 'cat-ext-2',
          providerPayload: {},
        },
      ])
      .execute();

    const result = content(
      await callTool(userId, 'finance_category_merge', {
        from: 'Merge Source',
        into: 'Merge Target',
      }),
    );
    expect(result.reason).toBeNull();
    expect(result.transactionsReassigned).toBe(2);
    expect(result.category).toEqual({ id: target.id, name: 'Merge Target' });
    expect(result.removedCategory).toEqual({ id: source.id, name: 'Merge Source' });

    const remaining = await db
      .selectFrom('app.financeTransactions')
      .select('categoryId')
      .where('userId', '=', userId)
      .where('id', 'in', [
        'f20000e2-0000-4000-8000-000000000001',
        'f20000e2-0000-4000-8000-000000000002',
      ])
      .execute();
    expect(remaining.every((row) => row.categoryId === target.id)).toBe(true);

    expect(await categoryByName(userId, 'Merge Source')).toBeUndefined();
  });

  it('dryRun counts what would move without writing', async () => {
    const source = content(
      await callTool(userId, 'finance_category_create', { name: 'Dry Source' }),
    );
    await callTool(userId, 'finance_category_create', { name: 'Dry Target' });
    await db
      .insertInto('app.financeTransactions')
      .values({
        id: 'f20000e2-0000-4000-8000-000000000003',
        userId,
        accountId: checkingId,
        postedOn: '2026-06-03',
        description: 'Row three',
        amount: -300,
        currencyCode: 'USD',
        transactionType: 'debit',
        pending: false,
        categoryId: source.id ?? '',
        excluded: false,
        externalId: 'cat-ext-3',
        providerPayload: {},
      })
      .execute();

    const result = content(
      await callTool(userId, 'finance_category_merge', {
        from: 'Dry Source',
        into: 'Dry Target',
        dryRun: true,
      }),
    );
    expect(result.transactionsReassigned).toBe(1);
    expect(result.dryRun).toBe(true);
    expect(result.removedCategory).toBeNull();

    const row = await db
      .selectFrom('app.financeTransactions')
      .select('categoryId')
      .where('id', '=', 'f20000e2-0000-4000-8000-000000000003')
      .executeTakeFirstOrThrow();
    expect(row.categoryId).toBe(source.id);
  });

  it('moves both transactions to Uncategorized and removes the source', async () => {
    const source = content(
      await callTool(userId, 'finance_category_create', { name: 'Source For Uncategorized' }),
    );
    const target = content(
      await callTool(userId, 'finance_category_create', { name: 'Uncategorized' }),
    );
    const before = await db
      .selectFrom('app.financeCategories')
      .select('id')
      .where('userId', '=', userId)
      .execute();
    await db
      .insertInto('app.financeTransactions')
      .values([
        {
          id: 'f20000e2-0000-4000-8000-000000000013',
          userId,
          accountId: checkingId,
          postedOn: '2026-06-13',
          description: 'Uncategorized move one',
          amount: -100,
          currencyCode: 'USD',
          transactionType: 'debit',
          pending: false,
          categoryId: source.id!,
          excluded: false,
          externalId: 'cat-uncategorized-ext-1',
          providerPayload: {},
        },
        {
          id: 'f20000e2-0000-4000-8000-000000000014',
          userId,
          accountId: checkingId,
          postedOn: '2026-06-14',
          description: 'Uncategorized move two',
          amount: -200,
          currencyCode: 'USD',
          transactionType: 'debit',
          pending: false,
          categoryId: source.id!,
          excluded: false,
          externalId: 'cat-uncategorized-ext-2',
          providerPayload: {},
        },
      ])
      .execute();

    const merged = content(
      await callTool(userId, 'finance_category_merge', {
        from: source.id!,
        into: target.id!,
      }),
    );
    expect(merged).toMatchObject({
      transactionsReassigned: 2,
      category: { id: target.id, name: 'Uncategorized' },
      removedCategory: { id: source.id, name: 'Source For Uncategorized' },
      reason: null,
    });
    const rows = await db
      .selectFrom('app.financeTransactions')
      .select('categoryId')
      .where('userId', '=', userId)
      .where('id', 'in', [
        'f20000e2-0000-4000-8000-000000000013',
        'f20000e2-0000-4000-8000-000000000014',
      ])
      .execute();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.categoryId === target.id)).toBe(true);
    expect(await categoryByName(userId, 'Source For Uncategorized')).toBeUndefined();
    const after = await db
      .selectFrom('app.financeCategories')
      .select('id')
      .where('userId', '=', userId)
      .execute();
    expect(after).toHaveLength(before.length - 1);
  });

  it('may merge into Uncategorized but never out of it', async () => {
    const source = content(await callTool(userId, 'finance_category_create', { name: 'To Junk' }));
    await callTool(userId, 'finance_category_create', { name: 'Uncategorized' });

    const intoJunk = content(
      await callTool(userId, 'finance_category_merge', {
        from: 'To Junk',
        into: 'Uncategorized',
      }),
    );
    expect(intoJunk.reason).toBeNull();

    const outOfJunk = content(
      await callTool(userId, 'finance_category_merge', {
        from: 'Uncategorized',
        into: 'To Junk',
      }),
    );
    expect(outOfJunk.reason).toBe('protected_category');
    expect(source.id).toBeTruthy();
  });

  it('reports an unknown category', async () => {
    const result = content(
      await callTool(userId, 'finance_category_merge', { from: 'nope', into: 'Uncategorized' }),
    );
    expect(result.reason).toBe('unknown_category');
  });
});

describe('finance_category_delete', () => {
  it('deletes an unused category addressed by id', async () => {
    const created = content(
      await callTool(userId, 'finance_category_create', { name: 'Unused To Delete' }),
    );
    const before = await db
      .selectFrom('app.financeCategories')
      .select('id')
      .where('userId', '=', userId)
      .execute();

    const result = content(
      await callTool(userId, 'finance_category_delete', {
        category: created.id!,
        iUnderstand: true,
      }),
    );
    expect(result.deleted).toEqual({ id: created.id, name: 'Unused To Delete' });
    expect(await categoryByName(userId, 'Unused To Delete')).toBeUndefined();

    const after = await db
      .selectFrom('app.financeCategories')
      .select('id')
      .where('userId', '=', userId)
      .execute();
    expect(after).toHaveLength(before.length - 1);
  });

  it('refuses an in-use category with the exact referencing transaction count', async () => {
    const created = content(
      await callTool(userId, 'finance_category_create', { name: 'Category In Use' }),
    );
    await db
      .insertInto('app.financeTransactions')
      .values([
        {
          id: 'f20000e2-0000-4000-8000-000000000011',
          userId,
          accountId: checkingId,
          postedOn: '2026-06-10',
          description: 'Referenced one',
          amount: -100,
          currencyCode: 'USD',
          transactionType: 'debit',
          pending: false,
          categoryId: created.id!,
          excluded: false,
          externalId: 'cat-delete-ext-1',
          providerPayload: {},
        },
        {
          id: 'f20000e2-0000-4000-8000-000000000012',
          userId,
          accountId: checkingId,
          postedOn: '2026-06-11',
          description: 'Referenced two',
          amount: -200,
          currencyCode: 'USD',
          transactionType: 'debit',
          pending: false,
          categoryId: created.id!,
          excluded: false,
          externalId: 'cat-delete-ext-2',
          providerPayload: {},
        },
      ])
      .execute();

    await expect(
      callTool(userId, 'finance_category_delete', {
        category: 'Category In Use',
        iUnderstand: true,
      }),
    ).rejects.toThrow('category_in_use: 2 transaction(s)');
    expect(await categoryByName(userId, 'Category In Use')).toBeDefined();
  });

  it('protects Uncategorized and hides another owner category as not-found', async () => {
    await callTool(userId, 'finance_category_create', { name: 'Uncategorized' });
    await expect(
      callTool(userId, 'finance_category_delete', {
        category: 'Uncategorized',
        iUnderstand: true,
      }),
    ).rejects.toThrow('category_protected');

    const other = content(
      await callTool(otherUserId, 'finance_category_create', { name: 'Other Owner Category' }),
    );
    await expect(
      callTool(userId, 'finance_category_delete', { category: other.id!, iUnderstand: true }),
    ).rejects.toThrow('Category not found');
  });
});
