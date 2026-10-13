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
  transactionsReassigned?: number;
  category?: { id: string; name: string } | null;
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
    expect(wouldCreate).toMatchObject({ created: true, id: null });
    expect(await categoryByName(userId, 'Dry Run Cat')).toBeUndefined();
  });
});

describe('finance_category_merge', () => {
  it('reassigns transactions and leaves the emptied category in place', async () => {
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

    // The emptied category is kept (budgets reference categories), just unused.
    expect(await categoryByName(userId, 'Merge Source')).toBeDefined();
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

    const row = await db
      .selectFrom('app.financeTransactions')
      .select('categoryId')
      .where('id', '=', 'f20000e2-0000-4000-8000-000000000003')
      .executeTakeFirstOrThrow();
    expect(row.categoryId).toBe(source.id);
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
