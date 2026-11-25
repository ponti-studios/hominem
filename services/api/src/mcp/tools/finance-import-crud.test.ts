import { db, pool, sql } from '@hominem/db/core';
import { parseSheetTransactionsCsv } from '@hominem/finance-services';
import { beforeAll, describe, expect, it } from 'vitest';

import { updateFinanceTransactions } from '../../application/finance.transactions-management.service';
import { callTool, type McpToolResult } from '../tool-registry';
import './finance';

const userId = 'f2000010-0000-4000-8000-000000000001';
const otherUserId = 'f2000010-0000-4000-8000-000000000002';
const checkingId = 'f2000011-0000-4000-8000-000000000001';
const gbpId = 'f2000011-0000-4000-8000-000000000002';
const secondCheckingId = 'f2000011-0000-4000-8000-000000000003';
const thirdCheckingId = 'f2000011-0000-4000-8000-000000000004';
const otherCheckingId = 'f2000011-0000-4000-8000-000000000005';

type Content = Record<string, unknown> & {
  categories?: Array<{ id: string; name: string }>;
  count?: number;
  created?: boolean;
  id?: string;
  accountId?: string;
  received?: number;
  upserted?: number;
  createdCount?: number;
  rejected?: Array<{ index: number; reason: string; key?: string }>;
  transactions?: Array<Record<string, unknown>>;
};

function content(res: McpToolResult<Content>): Content {
  return res.structuredContent ?? {};
}

beforeAll(async () => {
  for (const id of [userId, otherUserId]) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, `Sheet Import User ${id}`, `${id}@test.hominem.dev`, true],
    );
  }
  for (const id of [userId, otherUserId]) {
    await db.deleteFrom('app.financeTransactions').where('userId', '=', id).execute();
    await db.deleteFrom('app.financeCategories').where('userId', '=', id).execute();
    await db.deleteFrom('app.tags').where('ownerUserid', '=', id).execute();
    await db.deleteFrom('app.financeAccounts').where('userId', '=', id).execute();
  }
  await db
    .insertInto('app.financeAccounts')
    .values([
      {
        id: checkingId,
        userId,
        name: 'Sheet Checking',
        accountType: 'checking',
        currencyCode: 'USD',
        lifecycleStatus: 'open',
        includeInNetWorth: true,
        metadata: {},
      },
      {
        id: gbpId,
        userId,
        name: 'Sheet GBP',
        accountType: 'checking',
        currencyCode: 'GBP',
        lifecycleStatus: 'open',
        includeInNetWorth: true,
        metadata: {},
      },
      {
        id: secondCheckingId,
        userId,
        name: 'Sheet Checking Two',
        accountType: 'checking',
        currencyCode: 'USD',
        lifecycleStatus: 'open',
        includeInNetWorth: true,
        metadata: {},
      },
      {
        id: thirdCheckingId,
        userId,
        name: 'Sheet Checking Three',
        accountType: 'checking',
        currencyCode: 'USD',
        lifecycleStatus: 'open',
        includeInNetWorth: true,
        metadata: {},
      },
      {
        id: otherCheckingId,
        userId: otherUserId,
        name: 'Other Sheet Checking',
        accountType: 'checking',
        currencyCode: 'USD',
        lifecycleStatus: 'open',
        includeInNetWorth: true,
        metadata: {},
      },
    ])
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();
});

describe('finance_categories', () => {
  it('starts empty and gains Uncategorized plus sheet categories on import', async () => {
    const before = await callTool(userId, 'finance_categories', {});
    expect(content(before).categories).toEqual([]);

    await callTool(userId, 'finance_transaction_upsert', {
      postedOn: '2026-08-24',
      account: checkingId,
      description: 'Example Airways',
      amountCents: -10000,
      currencyCode: 'USD',
      category: 'Air Travel',
    });

    const after = await callTool(userId, 'finance_categories', {});
    const names = (content(after).categories ?? []).map((c) => c.name);
    expect(names).toContain('Air Travel');
  });
});

describe('finance_transaction_upsert', () => {
  it('preserves omitted fields, applies explicit clears, and supports provider identity and type changes', async () => {
    const row = {
      postedOn: '2026-09-04',
      account: checkingId,
      description: 'Patch Semantics',
      amountCents: -1234,
      currencyCode: 'USD',
      category: 'Initial Category',
      tags: ['keep-me'],
      notes: 'N',
      orderNumber: 'ORDER-7',
      excluded: true,
      recurring: true,
      transactionType: 'debit',
      externalId: 'provider-patch-1',
    };
    const created = content(await callTool(userId, 'finance_transaction_upsert', row));
    const id = String(created.id);
    const partial = content(
      await callTool(userId, 'finance_transaction_upsert', {
        postedOn: row.postedOn,
        account: row.account,
        description: row.description,
        amountCents: row.amountCents,
        currencyCode: row.currencyCode,
        category: 'Updated Category',
        externalId: row.externalId,
      }),
    );
    expect(partial).toMatchObject({ id, created: false });
    let stored = await db
      .selectFrom('app.financeTransactions')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    expect(stored).toMatchObject({
      notes: 'N',
      orderNumber: 'ORDER-7',
      excluded: true,
      recurring: true,
      transactionType: 'debit',
    });
    expect(
      await db.selectFrom('app.tagAssignments').select('id').where('entityId', '=', id).execute(),
    ).toHaveLength(1);

    const search = content(
      await callTool(userId, 'finance_transaction_search', { query: 'Patch Semantics' }),
    );
    expect(search.transactions?.[0]).toMatchObject({ id, notes: 'N', orderNumber: 'ORDER-7' });

    const changedType = content(
      await callTool(userId, 'finance_transaction_upsert', { ...row, transactionType: 'transfer' }),
    );
    expect(changedType).toMatchObject({ id, created: false });
    stored = await db
      .selectFrom('app.financeTransactions')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    expect(stored.transactionType).toBe('transfer');
    const transferSearch = content(
      await callTool(userId, 'finance_transaction_search', {
        transactionType: 'transfer',
        categoryName: 'Initial Category',
      }),
    );
    expect(transferSearch.transactions?.some((transaction) => transaction.id === id)).toBe(true);
    await db
      .updateTable('app.financeTransactions')
      .set({ excluded: false })
      .where('id', '=', id)
      .execute();
    const transferSpending = content(
      await callTool(userId, 'finance_spending_by_category', {
        from: '2026-09-01',
        to: '2026-09-30',
      }),
    );
    expect(transferSpending.categories).toHaveLength(0);
    await callTool(userId, 'finance_transaction_upsert', { ...row, transactionType: 'debit' });
    await db
      .updateTable('app.financeTransactions')
      .set({ excluded: false })
      .where('id', '=', id)
      .execute();
    stored = await db
      .selectFrom('app.financeTransactions')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    expect(stored.transactionType).toBe('debit');
    const debitSpending = content(
      await callTool(userId, 'finance_spending_by_category', {
        from: '2026-09-01',
        to: '2026-09-30',
      }),
    );
    expect(debitSpending.categories).toHaveLength(1);

    await callTool(userId, 'finance_transaction_upsert', { ...row, tags: [] });
    expect(
      await db.selectFrom('app.tagAssignments').select('id').where('entityId', '=', id).execute(),
    ).toHaveLength(0);
  });

  it('uses externalId across corrected source values without merging distinct transactions', async () => {
    const common = {
      postedOn: '2026-09-05',
      account: checkingId,
      description: 'Same Natural Row',
      amountCents: -250,
      currencyCode: 'USD',
      source: 'plaid',
    };
    const one = content(
      await callTool(userId, 'finance_transaction_upsert', {
        ...common,
        externalId: 'provider-one',
      }),
    );
    const two = content(
      await callTool(userId, 'finance_transaction_upsert', {
        ...common,
        externalId: 'provider-two',
      }),
    );
    expect(one.id).not.toBe(two.id);
    const replay = content(
      await callTool(userId, 'finance_transactions_import', {
        transactions: [
          { ...common, externalId: 'provider-one' },
          { ...common, externalId: 'provider-two' },
        ],
      }),
    );
    expect(replay).toMatchObject({ created: 0, updated: 0 });
    const corrected = content(
      await callTool(userId, 'finance_transaction_upsert', {
        ...common,
        externalId: 'provider-one',
        amountCents: -325,
        description: 'Corrected Description',
      }),
    );
    expect(corrected).toMatchObject({ id: one.id, created: false });
    const row = await db
      .selectFrom('app.financeTransactions')
      .select(['amount', 'description'])
      .where('id', '=', String(one.id))
      .executeTakeFirstOrThrow();
    expect(row).toMatchObject({ amount: -3.25, description: 'Corrected Description' });
  });

  it('creates then re-upserts without duplicating', async () => {
    const first = await callTool(userId, 'finance_transaction_upsert', {
      postedOn: '2026-09-01',
      account: 'Sheet Checking',
      description: 'Grocery Store',
      amountCents: -5000,
      currencyCode: 'USD',
      category: 'Groceries',
      tags: ['weekly-shop'],
      source: 'plaid',
    });
    expect(content(first)).toMatchObject({ created: true, accountId: checkingId });

    const second = await callTool(userId, 'finance_transaction_upsert', {
      postedOn: '2026-09-01',
      account: 'Sheet Checking',
      description: 'Grocery Store',
      amountCents: -5000,
      currencyCode: 'USD',
      category: 'Groceries',
      tags: ['weekly-shop'],
      source: 'plaid',
    });
    expect(content(second)).toMatchObject({ created: false, accountId: checkingId });
    expect(content(second).id).toBe(content(first).id);

    const rows = await db
      .selectFrom('app.financeTransactions')
      .select('id')
      .where('userId', '=', userId)
      .where('description', '=', 'Grocery Store')
      .execute();
    expect(rows).toHaveLength(1);
  });

  it('matches the natural key across sources and updates source metadata', async () => {
    const input = {
      postedOn: '2026-09-03',
      account: 'Sheet Checking',
      description: 'Source Correction',
      amountCents: -4200,
      currencyCode: 'USD',
    };
    const imported = await callTool(userId, 'finance_transaction_upsert', {
      ...input,
      source: 'plaid',
    });
    const corrected = await callTool(userId, 'finance_transaction_upsert', {
      ...input,
      source: 'manual',
    });

    expect(content(imported)).toMatchObject({ created: true });
    expect(content(corrected)).toMatchObject({
      id: content(imported).id,
      created: false,
      accountId: checkingId,
    });
    const row = await db
      .selectFrom('app.financeTransactions')
      .select(['source', 'externalId'])
      .where('id', '=', String(content(imported).id))
      .executeTakeFirstOrThrow();
    expect(row.source).toBe('manual');
    expect(row.externalId).toBeTruthy();
    const duplicateCount = await db
      .selectFrom('app.financeTransactions')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('userId', '=', userId)
      .where('description', '=', input.description)
      .executeTakeFirstOrThrow();
    expect(Number(duplicateCount.count)).toBe(1);
  });

  it('serializes concurrent cross-source inserts for the same sheet identity', async () => {
    const input = {
      postedOn: '2026-09-05',
      account: checkingId,
      description: 'Concurrent source import',
      amountCents: -765,
      currencyCode: 'USD',
    };
    const results = await Promise.all([
      callTool(userId, 'finance_transaction_upsert', { ...input, source: 'plaid' }),
      callTool(userId, 'finance_transaction_upsert', { ...input, source: 'starling' }),
    ]);
    const ids = results.map((result) => content(result).id);
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBe(ids[0]);

    const duplicateCount = await db
      .selectFrom('app.financeTransactions')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('userId', '=', userId)
      .where('description', '=', input.description)
      .executeTakeFirstOrThrow();
    expect(Number(duplicateCount.count)).toBe(1);
  });

  it('infers transfer from description text', async () => {
    const result = await callTool(userId, 'finance_transaction_upsert', {
      postedOn: '2026-09-02',
      account: checkingId,
      description: 'Internet Transfer To Savings',
      amountCents: -10000,
      currencyCode: 'USD',
    });
    const id = content(result).id ?? '';
    const row = await db
      .selectFrom('app.financeTransactions')
      .select('transactionType')
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    expect(row.transactionType).toBe('transfer');
  });

  it('accepts an explicit adjustment transaction type', async () => {
    const result = await callTool(userId, 'finance_transaction_upsert', {
      postedOn: '2026-09-04',
      account: checkingId,
      description: 'Balance normalization',
      amountCents: 125,
      currencyCode: 'USD',
      transactionType: 'adjustment',
    });
    const row = await db
      .selectFrom('app.financeTransactions')
      .select('transactionType')
      .where('id', '=', String(content(result).id))
      .executeTakeFirstOrThrow();
    expect(row.transactionType).toBe('adjustment');
  });

  it('keeps notes verbatim and stores order number independently', async () => {
    const result = await callTool(userId, 'finance_transaction_upsert', {
      postedOn: '2026-09-03',
      account: checkingId,
      description: 'Netflix',
      amountCents: -1599,
      currencyCode: 'USD',
      recurring: true,
      orderNumber: 'ABC-123',
      notes: 'monthly sub',
    });
    const id = content(result).id ?? '';
    const row = await db
      .selectFrom('app.financeTransactions')
      .select(['recurring', 'notes', 'orderNumber'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    expect(row.recurring).toBe(true);
    expect(row.notes).toBe('monthly sub');
    expect(row.orderNumber).toBe('ABC-123');
  });

  it('reads tags, notes, source and recurring back through the read tools (B2)', async () => {
    const up = await callTool(userId, 'finance_transaction_upsert', {
      postedOn: '2026-10-08',
      account: 'Sheet Checking',
      description: 'Round Trip Row',
      amountCents: -4200,
      currencyCode: 'USD',
      tags: ['weekly-shop'],
      notes: 'round trip',
      source: 'plaid',
      recurring: true,
    });
    const id = content(up).id ?? '';

    const byId = (res: McpToolResult<Content>) =>
      content(res).transactions?.find((t) => t.id === id);

    const search = byId(
      await callTool(userId, 'finance_transaction_search', { query: 'Round Trip Row' }),
    );
    expect(search).toMatchObject({
      notes: 'round trip',
      source: 'plaid',
      recurring: true,
      transactionType: 'debit',
      accountName: 'Sheet Checking',
    });
    expect(search?.tags).toEqual(['weekly-shop']);

    const recent = byId(await callTool(userId, 'finance_recent_transactions', { limit: 50 }));
    expect(recent).toMatchObject({ notes: 'round trip', source: 'plaid', recurring: true });
    expect(recent?.tags).toEqual(['weekly-shop']);
  });

  it('rejects unknown accounts and currency mismatches', async () => {
    const unknown = await callTool(userId, 'finance_transaction_upsert', {
      postedOn: '2026-09-04',
      account: 'No Such Bank …9999',
      description: 'Bogus',
      amountCents: -100,
      currencyCode: 'USD',
    });
    expect(content(unknown)).toMatchObject({ id: null, reason: 'unknown_account' });

    const mismatch = await callTool(userId, 'finance_transaction_upsert', {
      postedOn: '2026-09-04',
      account: gbpId,
      description: 'Bogus GBP',
      amountCents: -100,
      currencyCode: 'USD',
    });
    expect(content(mismatch)).toMatchObject({ id: null, reason: 'currency_mismatch' });
  });

  it('isolates cross-user account resolution', async () => {
    const result = await callTool(otherUserId, 'finance_transaction_upsert', {
      postedOn: '2026-09-05',
      account: checkingId,
      description: 'Sneaky',
      amountCents: -100,
      currencyCode: 'USD',
    });
    expect(content(result)).toMatchObject({ id: null, reason: 'unknown_account' });
  });
});

describe('finance_transactions_import', () => {
  it('preserves user annotations on provider re-sync while applying provider corrections', async () => {
    const row = {
      postedOn: '2026-10-25',
      account: checkingId,
      description: 'Overlapping feed',
      amountCents: -1234,
      currencyCode: 'USD',
      source: 'plaid',
      externalId: 'overlapping-feed-1',
      category: 'Feed category',
      tags: ['feed-tag'],
      notes: 'Feed note',
    };
    const created = content(
      await callTool(userId, 'finance_transactions_import', { transactions: [row] }),
    );
    expect(created).toMatchObject({ created: 1, updated: 0 });
    const transaction = await db
      .selectFrom('app.financeTransactions')
      .select('id')
      .where('userId', '=', userId)
      .where('description', '=', row.description)
      .executeTakeFirstOrThrow();
    const initial = content(
      await callTool(userId, 'finance_transaction_search', { query: row.description }),
    );
    expect(initial.transactions).toEqual([
      expect.objectContaining({
        id: transaction.id,
        categoryName: row.category,
        tags: row.tags,
        notes: row.notes,
      }),
    ]);

    const category = await db
      .insertInto('app.financeCategories')
      .values({ userId, name: 'User category' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const tag = await db
      .insertInto('app.tags')
      .values({
        ownerUserid: userId,
        name: 'user-tag',
        slug: 'user-tag',
        path: 'user-tag',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await updateFinanceTransactions(userId, [transaction.id], {
      action: 'category',
      categoryId: category.id,
      tagIds: [tag.id],
    });
    await updateFinanceTransactions(userId, [transaction.id], {
      action: 'notes',
      value: 'User note',
    });

    const replay = {
      ...row,
      category: 'Ignored provider category',
      tags: ['ignored-provider-tag'],
      notes: 'Ignored provider note',
    };
    const preview = content(
      await callTool(userId, 'finance_transactions_import', {
        dryRun: true,
        transactions: [replay],
      }),
    );
    const unchanged = content(
      await callTool(userId, 'finance_transactions_import', { transactions: [replay] }),
    );
    expect(preview).toMatchObject({ created: 0, updated: 0 });
    expect(unchanged).toMatchObject({ created: 0, updated: 0 });

    const corrected = { ...replay, description: 'Corrected overlapping feed', amountCents: -1500 };
    const correctionPreview = content(
      await callTool(userId, 'finance_transactions_import', {
        dryRun: true,
        transactions: [corrected],
      }),
    );
    const correction = content(
      await callTool(userId, 'finance_transactions_import', { transactions: [corrected] }),
    );
    expect(correctionPreview).toMatchObject({ created: 0, updated: 1 });
    expect(correction).toMatchObject({ created: 0, updated: 1 });
    const result = content(
      await callTool(userId, 'finance_transaction_search', { query: corrected.description }),
    );
    expect(result.transactions).toEqual([
      expect.objectContaining({
        id: transaction.id,
        amount: -15,
        categoryName: 'User category',
        tags: ['user-tag'],
        notes: 'User note',
      }),
    ]);
    expect(
      await db
        .selectFrom('app.financeCategories')
        .select('id')
        .where('userId', '=', userId)
        .where('name', '=', replay.category)
        .execute(),
    ).toEqual([]);
    expect(
      await db
        .selectFrom('app.tags')
        .select('id')
        .where('ownerUserid', '=', userId)
        .where('name', '=', replay.tags[0]!)
        .execute(),
    ).toEqual([]);
  });

  it('allows explicit provider annotation replacement and retains manual patch semantics', async () => {
    const row = {
      postedOn: '2026-10-26',
      account: checkingId,
      description: 'Annotation replacement',
      amountCents: -500,
      currencyCode: 'USD',
      source: 'starling',
      externalId: 'annotation-replacement-1',
      category: 'Original annotation',
      tags: ['original-annotation'],
      notes: 'Original note',
    };
    await callTool(userId, 'finance_transactions_import', { transactions: [row] });
    const clear = { ...row, category: null, tags: [], notes: null };
    const preview = content(
      await callTool(userId, 'finance_transactions_import', {
        transactions: [clear],
        overwriteAnnotations: true,
        dryRun: true,
      }),
    );
    const update = content(
      await callTool(userId, 'finance_transactions_import', {
        transactions: [clear],
        overwriteAnnotations: true,
      }),
    );
    expect(preview).toMatchObject({ created: 0, updated: 1 });
    expect(update).toMatchObject({ created: 0, updated: 1 });
    const updated = content(
      await callTool(userId, 'finance_transaction_search', { query: row.description }),
    );
    expect(updated.transactions).toEqual([
      expect.objectContaining({ categoryName: 'Uncategorized', tags: [], notes: null }),
    ]);

    const manual = { ...row, source: 'manual', externalId: 'manual-annotation-replacement' };
    await callTool(userId, 'finance_transactions_import', { transactions: [manual] });
    const manualUpdate = content(
      await callTool(userId, 'finance_transactions_import', {
        transactions: [{ ...manual, notes: 'Manual correction' }],
      }),
    );
    expect(manualUpdate).toMatchObject({ created: 0, updated: 1 });
    const manualResult = await db
      .selectFrom('app.financeTransactions')
      .select('notes')
      .where('userId', '=', userId)
      .where('externalId', '=', manual.externalId)
      .executeTakeFirstOrThrow();
    expect(manualResult.notes).toBe('Manual correction');
  });

  it('preserves annotations when a provider replay uses the natural key', async () => {
    const row = {
      postedOn: '2026-10-29',
      account: checkingId,
      description: 'Natural-key provider replay',
      amountCents: -250,
      currencyCode: 'USD',
      source: 'starling',
      category: 'Natural feed category',
      tags: ['natural-feed-tag'],
    };
    await callTool(userId, 'finance_transactions_import', { transactions: [row] });
    const transaction = await db
      .selectFrom('app.financeTransactions')
      .select('id')
      .where('userId', '=', userId)
      .where('description', '=', row.description)
      .executeTakeFirstOrThrow();
    await updateFinanceTransactions(userId, [transaction.id], {
      action: 'notes',
      value: 'Natural-key user note',
    });

    const replay = content(
      await callTool(userId, 'finance_transactions_import', {
        transactions: [{ ...row, notes: 'Feed note' }],
      }),
    );
    expect(replay).toMatchObject({ created: 0, updated: 0 });
    const stored = await db
      .selectFrom('app.financeTransactions')
      .select('notes')
      .where('id', '=', transaction.id)
      .where('userId', '=', userId)
      .executeTakeFirstOrThrow();
    expect(stored.notes).toBe('Natural-key user note');
  });

  it('does not overwrite annotations edited while a provider correction is waiting to write', async () => {
    const row = {
      postedOn: '2026-10-27',
      account: checkingId,
      description: 'Concurrent annotation edit',
      amountCents: -100,
      currencyCode: 'USD',
      source: 'starling',
      externalId: 'concurrent-annotation-edit',
      notes: 'Feed note',
    };
    await callTool(userId, 'finance_transactions_import', { transactions: [row] });
    const transaction = await db
      .selectFrom('app.financeTransactions')
      .select('id')
      .where('userId', '=', userId)
      .where('externalId', '=', row.externalId)
      .executeTakeFirstOrThrow();
    const client = await pool.connect();
    let committed = false;
    let sync: Promise<McpToolResult> | undefined;
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE app.finance_transactions SET notes = $1 WHERE id = $2 AND user_id = $3',
        ['Concurrent user note', transaction.id, userId],
      );
      const { rows } = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      const blockerPid = rows[0]!.pid;
      sync = callTool(userId, 'finance_transactions_import', {
        transactions: [{ ...row, amountCents: -200 }],
      });

      let blocked = false;
      const deadline = Date.now() + 5000;
      while (!blocked && Date.now() < deadline) {
        const status = await pool.query<{ blocked: boolean }>(
          'SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS blocked',
          [blockerPid],
        );
        blocked = status.rows[0]!.blocked;
        if (!blocked) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(blocked).toBe(true);
      await client.query('COMMIT');
      committed = true;
      expect(content(await sync)).toMatchObject({ created: 0, updated: 1 });
    } finally {
      if (!committed) {
        await client.query('ROLLBACK');
        if (sync) await sync;
      }
      client.release();
    }

    const stored = await db
      .selectFrom('app.financeTransactions')
      .select(['amount', 'notes'])
      .where('id', '=', transaction.id)
      .where('userId', '=', userId)
      .executeTakeFirstOrThrow();
    expect(stored).toEqual({ amount: -2, notes: 'Concurrent user note' });
  });

  it('keeps provider re-syncs and annotation overrides scoped to the owner', async () => {
    const row = {
      postedOn: '2026-10-28',
      account: checkingId,
      description: 'Owner-scoped provider identity',
      amountCents: -200,
      currencyCode: 'USD',
      source: 'plaid',
      externalId: 'shared-provider-id',
      notes: 'First owner',
    };
    await callTool(userId, 'finance_transactions_import', { transactions: [row] });
    const denied = content(
      await callTool(otherUserId, 'finance_transactions_import', { transactions: [row] }),
    );
    expect(denied.rejected).toEqual([{ index: 0, reason: 'unknown_account' }]);

    const otherRow = { ...row, account: otherCheckingId, notes: 'Second owner' };
    const created = content(
      await callTool(otherUserId, 'finance_transactions_import', { transactions: [otherRow] }),
    );
    expect(created).toMatchObject({ created: 1, updated: 0 });
    await callTool(otherUserId, 'finance_transactions_import', {
      transactions: [{ ...otherRow, notes: 'Second owner correction' }],
      overwriteAnnotations: true,
    });
    const rows = await db
      .selectFrom('app.financeTransactions')
      .select(['userId', 'notes'])
      .where('externalId', '=', row.externalId)
      .where('userId', 'in', [userId, otherUserId])
      .orderBy('userId')
      .execute();
    expect(rows).toEqual([
      { userId, notes: 'First owner' },
      { userId: otherUserId, notes: 'Second owner correction' },
    ]);
  });

  it('rejects unknown item keys individually while importing valid neighbors', async () => {
    const result = content(
      await callTool(userId, 'finance_transactions_import', {
        transactions: [
          {
            postedOn: '2026-10-06',
            account: checkingId,
            description: 'Wrong Field',
            amountCents: -100,
            currencyCode: 'USD',
            categoryName: 'Ignored',
          },
          {
            postedOn: '2026-10-07',
            account: checkingId,
            description: 'Valid Neighbor',
            amountCents: -200,
            currencyCode: 'USD',
          },
        ],
      }),
    );
    expect(result).toMatchObject({ received: 2, upserted: 1, created: 1 });
    expect(result.rejected).toEqual([
      { index: 0, reason: 'unknown_item_key', key: 'categoryName' },
    ]);
  });

  it('imports a batch, collects rejections, and re-runs to zero', async () => {
    const batch = {
      mode: 'append',
      transactions: [
        {
          postedOn: '2026-10-01',
          account: 'Sheet Checking',
          description: 'Dining Out Test',
          amountCents: -2500,
          currencyCode: 'USD',
          category: 'Dining Out',
        },
        {
          postedOn: '2026-10-02',
          account: 'Mystery Bank …0000',
          description: 'Unknown Bank Row',
          amountCents: -100,
          currencyCode: 'USD',
        },
        {
          postedOn: '2026-10-03',
          account: 'Sheet GBP',
          description: 'Wrong Currency Row',
          amountCents: -100,
          currencyCode: 'USD',
        },
        {
          postedOn: '2026-10-04',
          account: 'Sheet Checking',
          description: 'Transfer From Starling',
          amountCents: 50000,
          currencyCode: 'USD',
        },
      ],
    };

    const first = await callTool(userId, 'finance_transactions_import', batch);
    expect(content(first)).toMatchObject({ received: 4, upserted: 2, created: 2, updated: 0 });
    expect(content(first).rejected).toEqual([
      { index: 1, reason: 'unknown_account' },
      { index: 2, reason: 'currency_mismatch' },
    ]);

    const second = await callTool(userId, 'finance_transactions_import', batch);
    expect(content(second)).toMatchObject({ received: 4, upserted: 2, created: 0, updated: 0 });
  });

  it('imports parser output with blank cells straight through the tool contract', async () => {
    const { rows, invalid } = parseSheetTransactionsCsv(
      [
        'date,Bank,Merchant,Amount,Currency,Tags,Source,Order #,Category,Exclude?,Recurring?,Notes',
        '2026-08-24,Sheet Checking,Example Airways,"(100.00)",USD,,Plaid,,Air Travel,FALSE,FALSE,',
      ].join('\n'),
    );
    expect(invalid).toEqual([]);
    const result = await callTool(userId, 'finance_transactions_import', {
      mode: 'append',
      transactions: rows,
    });
    expect(content(result)).toMatchObject({ received: 1, created: 0, updated: 1 });
    expect(content(result).rejected).toEqual([]);
  });

  it('dryRun writes nothing', async () => {
    const before = await db
      .selectFrom('app.financeTransactions')
      .select('id')
      .where('userId', '=', userId)
      .execute();
    const result = await callTool(userId, 'finance_transactions_import', {
      mode: 'append',
      dryRun: true,
      transactions: [
        {
          postedOn: '2026-10-05',
          account: 'Sheet Checking',
          description: 'Dry Run Only',
          amountCents: -999,
          currencyCode: 'USD',
        },
      ],
    });
    expect(content(result)).toMatchObject({ received: 1, upserted: 1, created: 1, updated: 0 });
    const after = await db
      .selectFrom('app.financeTransactions')
      .select('id')
      .where('userId', '=', userId)
      .execute();
    expect(after.length).toBe(before.length);
  });

  it('dryRun projects updates for changed rows and creates for a replace', async () => {
    const row = {
      postedOn: '2026-10-07',
      account: 'Sheet Checking',
      description: 'Projection Row',
      amountCents: -321,
      currencyCode: 'USD',
    };
    await callTool(userId, 'finance_transactions_import', {
      mode: 'append',
      transactions: [row],
    });
    // Identical row: nothing changes, so neither created nor updated.
    const identical = await callTool(userId, 'finance_transactions_import', {
      mode: 'append',
      dryRun: true,
      transactions: [row],
    });
    expect(content(identical)).toMatchObject({ received: 1, upserted: 1, created: 0, updated: 0 });
    // Changed row: projects as an update.
    const changed = await callTool(userId, 'finance_transactions_import', {
      mode: 'append',
      dryRun: true,
      transactions: [{ ...row, notes: 'now changed' }],
    });
    expect(content(changed)).toMatchObject({ received: 1, upserted: 1, created: 0, updated: 1 });
    // A replace dry run wipes first, so every valid row projects as a create.
    const replace = await callTool(userId, 'finance_transactions_import', {
      mode: 'replace',
      dryRun: true,
      transactions: [row],
    });
    expect(content(replace)).toMatchObject({ received: 1, upserted: 1, created: 1, updated: 0 });
  });

  it('dryRun counts corrections to external-id transaction fields', async () => {
    await db
      .updateTable('app.financeAccounts')
      .set({ allowedCurrencies: ['USD'] })
      .where('id', '=', gbpId)
      .execute();
    const original = {
      postedOn: '2026-10-09',
      account: gbpId,
      description: 'Original provider description',
      amountCents: -500,
      currencyCode: 'GBP',
      externalId: 'provider-correction-1',
    };
    await callTool(userId, 'finance_transactions_import', { transactions: [original] });

    const corrected = {
      ...original,
      postedOn: '2026-10-10',
      description: 'Corrected provider description',
      amountCents: -650,
      currencyCode: 'USD',
    };
    const dryRun = await callTool(userId, 'finance_transactions_import', {
      dryRun: true,
      transactions: [corrected],
    });
    expect(content(dryRun)).toMatchObject({ created: 0, updated: 1 });

    await callTool(userId, 'finance_transactions_import', { transactions: [corrected] });
    const stored = await db
      .selectFrom('app.financeTransactions')
      .select(['amount', 'description', 'postedOn', 'currencyCode'])
      .where('userId', '=', userId)
      .where('externalId', '=', original.externalId)
      .executeTakeFirstOrThrow();
    expect(stored).toMatchObject({
      amount: -6.5,
      description: corrected.description,
      postedOn: corrected.postedOn,
      currencyCode: corrected.currencyCode,
    });
    await db
      .updateTable('app.financeAccounts')
      .set({ allowedCurrencies: [] })
      .where('id', '=', gbpId)
      .execute();
  });

  it('dryRun counts settlement-only changes', async () => {
    const original = {
      postedOn: '2026-10-11',
      account: gbpId,
      description: 'Settlement Preview',
      amountCents: -500,
      currencyCode: 'GBP',
      externalId: 'settlement-preview-1',
    };
    await callTool(userId, 'finance_transactions_import', { transactions: [original] });

    const settled = {
      ...original,
      settledAmountCents: 645,
      settledCurrencyCode: 'USD',
    };
    const preview = await callTool(userId, 'finance_transactions_import', {
      dryRun: true,
      transactions: [settled],
    });
    expect(content(preview)).toMatchObject({ created: 0, updated: 1 });

    await callTool(userId, 'finance_transactions_import', { transactions: [settled] });
    const stored = await db
      .selectFrom('app.financeTransactions')
      .select(['settledAmount', 'settledCurrencyCode'])
      .where('userId', '=', userId)
      .where('externalId', '=', original.externalId)
      .executeTakeFirstOrThrow();
    expect(stored).toMatchObject({ settledAmount: 6.45, settledCurrencyCode: 'USD' });
  });

  it('updates merchantName when an explicit provider identity corrects description', async () => {
    const row = {
      postedOn: '2026-10-11',
      account: checkingId,
      description: 'Old Merchant Label',
      amountCents: -1250,
      currencyCode: 'USD',
      externalId: 'provider-merchant-correction',
    };
    await callTool(userId, 'finance_transaction_upsert', row);
    await callTool(userId, 'finance_transaction_upsert', {
      ...row,
      description: 'Corrected Merchant Label',
    });
    const stored = await db
      .selectFrom('app.financeTransactions')
      .select(['description', 'merchantName'])
      .where('userId', '=', userId)
      .where('externalId', '=', row.externalId)
      .executeTakeFirstOrThrow();
    expect(stored).toEqual({
      description: 'Corrected Merchant Label',
      merchantName: 'Corrected Merchant Label',
    });
  });

  it('resolves a sheet identity across a corrected source without retrying inserts', async () => {
    const row = {
      postedOn: '2026-10-12',
      account: checkingId,
      description: 'Stable sheet identity',
      amountCents: -1250,
      currencyCode: 'USD',
      source: 'plaid',
    };
    const created = content(await callTool(userId, 'finance_transaction_upsert', row));
    const existing = await db
      .selectFrom('app.financeTransactions')
      .select(['id', 'externalId'])
      .where('id', '=', String(created.id))
      .executeTakeFirstOrThrow();
    const updated = content(
      await callTool(userId, 'finance_transaction_upsert', {
        ...row,
        source: 'manual',
        externalId: existing.externalId,
        description: 'Corrected stable sheet identity',
      }),
    );
    expect(updated).toMatchObject({ id: existing.id, created: false });
    const rows = await db
      .selectFrom('app.financeTransactions')
      .select(['id', 'source', 'description'])
      .where('userId', '=', userId)
      .where('externalId', '=', existing.externalId)
      .execute();
    expect(rows).toEqual([
      { id: existing.id, source: 'plaid', description: 'Corrected stable sheet identity' },
    ]);
  });

  it('recovers a concurrent sheet external-id insert conflict with one bounded retry', async () => {
    const row = {
      postedOn: '2026-10-14',
      account: checkingId,
      description: 'Concurrent identity',
      amountCents: -300,
      currencyCode: 'USD',
      source: 'manual',
      externalId: 'sheet:concurrent-insert-test',
    };
    const [first, second] = await Promise.all([
      callTool(userId, 'finance_transaction_upsert', row),
      callTool(userId, 'finance_transaction_upsert', row),
    ]);
    expect(first.isError).not.toBe(true);
    expect(second.isError).not.toBe(true);
    expect(content(first).id).toBe(content(second).id);
    const rows = await db
      .selectFrom('app.financeTransactions')
      .select('id')
      .where('userId', '=', userId)
      .where('externalId', '=', row.externalId)
      .execute();
    expect(rows).toHaveLength(1);
  });

  it('projects a cross-source natural-key match as an update', async () => {
    const row = {
      postedOn: '2026-10-08',
      account: 'Sheet Checking',
      description: 'Cross-source projection',
      amountCents: -1750,
      currencyCode: 'USD',
      source: 'plaid',
    };
    await callTool(userId, 'finance_transactions_import', {
      mode: 'append',
      transactions: [row],
    });
    const projection = await callTool(userId, 'finance_transactions_import', {
      mode: 'append',
      dryRun: true,
      transactions: [{ ...row, source: 'manual' }],
    });
    expect(content(projection)).toMatchObject({
      received: 1,
      upserted: 1,
      created: 0,
      updated: 1,
    });
  });

  it('replace wipes only the caller store then inserts', async () => {
    const dry = await callTool(userId, 'finance_transactions_import', {
      mode: 'append',
      dryRun: true,
      transactions: [
        {
          postedOn: '2026-10-06',
          account: 'Sheet Checking',
          description: 'Sole Survivor',
          amountCents: -100,
          currencyCode: 'USD',
        },
      ],
    });
    expect(content(dry).rejected).toEqual([]);
    expect(content(dry).dryRun).toBe(true);
    const result = await callTool(userId, 'finance_transactions_import', {
      mode: 'replace',
      iUnderstand: true,
      transactions: [
        {
          postedOn: '2026-10-06',
          account: 'Sheet Checking',
          description: 'Sole Survivor',
          amountCents: -100,
          currencyCode: 'USD',
        },
      ],
    });
    expect(content(result)).toMatchObject({ received: 1, created: 1 });
    const rows = await db
      .selectFrom('app.financeTransactions')
      .select('description')
      .where('userId', '=', userId)
      .execute();
    expect(rows.map((r) => r.description)).toEqual(['Sole Survivor']);
  });
});

describe('finance_transaction_move', () => {
  it('moves a linked excluded row without changing its identity or fields and enforces currency', async () => {
    const mirror = content(
      await callTool(userId, 'finance_transaction_upsert', {
        postedOn: '2026-09-08',
        account: secondCheckingId,
        description: 'Mirror Leg',
        amountCents: 5000,
        currencyCode: 'USD',
        transactionType: 'transfer',
        externalId: 'move-mirror',
      }),
    );
    const source = content(
      await callTool(userId, 'finance_transaction_upsert', {
        postedOn: '2026-09-08',
        account: checkingId,
        description: 'Move Leg',
        amountCents: -5000,
        currencyCode: 'USD',
        transactionType: 'transfer',
        tags: ['move-tag'],
        notes: 'keep notes',
        excluded: true,
        counterpartId: String(mirror.id),
        externalId: 'move-source',
      }),
    );
    await expect(
      callTool(userId, 'finance_transaction_move', {
        ids: [source.id],
        toAccount: secondCheckingId,
      }),
    ).rejects.toThrow('move_would_break_counterpart_accounts');
    await expect(
      callTool(userId, 'finance_transaction_move', {
        ids: [source.id, mirror.id],
        toAccount: thirdCheckingId,
      }),
    ).rejects.toThrow('move_would_break_counterpart_accounts');
    const before = await db
      .selectFrom('app.financeTransactions')
      .selectAll()
      .where('id', '=', String(source.id))
      .executeTakeFirstOrThrow();
    const result = content(
      await callTool(userId, 'finance_transaction_move', {
        ids: [source.id],
        toAccount: thirdCheckingId,
      }),
    );
    expect(result).toMatchObject({
      moved: [source.id],
      count: 1,
      accountId: thirdCheckingId,
      notFound: [],
    });
    const after = await db
      .selectFrom('app.financeTransactions')
      .selectAll()
      .where('id', '=', String(source.id))
      .executeTakeFirstOrThrow();
    expect(after).toMatchObject({
      id: before.id,
      accountId: thirdCheckingId,
      amount: before.amount,
      description: before.description,
      postedOn: before.postedOn,
      currencyCode: before.currencyCode,
      notes: before.notes,
      excluded: before.excluded,
      counterpartId: before.counterpartId,
    });
    expect(after.counterpartId).toBe(mirror.id);
    const mirrorAfter = await db
      .selectFrom('app.financeTransactions')
      .select('counterpartId')
      .where('id', '=', String(mirror.id))
      .executeTakeFirstOrThrow();
    expect(mirrorAfter.counterpartId).toBe(source.id);
    await expect(
      callTool(userId, 'finance_transaction_move', { ids: [source.id], toAccount: gbpId }),
    ).rejects.toThrow('currency_mismatch');
    const missingId = 'f2000022-0000-4000-8000-000000000099';
    expect(
      content(
        await callTool(userId, 'finance_transaction_move', {
          ids: [missingId],
          toAccount: checkingId,
        }),
      ),
    ).toMatchObject({ moved: [], count: 0, notFound: [missingId] });
  });
});

// B6: app.tags is unique on (owner, lower(name)) and on (owner, slug), but a sheet tag
// arrives with whatever casing the sheet used. A row tagged "Art" used to fail the whole
// write with a unique-violation 500 when an "art" tag already existed.
describe('tag name casing', () => {
  it('reuses an existing tag when the sheet uses different casing', async () => {
    await db
      .insertInto('app.tags')
      .values({ ownerUserid: userId, name: 'art', slug: 'art', path: 'art' })
      .onConflict((oc) => oc.doNothing())
      .execute();

    const result = await callTool(userId, 'finance_transactions_import', {
      mode: 'append',
      transactions: [
        {
          postedOn: '2026-10-09',
          account: 'Sheet Checking',
          description: 'Art Supplies',
          amountCents: -2500,
          currencyCode: 'USD',
          tags: ['Art'],
        },
      ],
    });
    expect(content(result)).toMatchObject({ received: 1, created: 1, rejected: [] });

    const tags = await db
      .selectFrom('app.tags')
      .select(['id', 'name'])
      .where('ownerUserid', '=', userId)
      .where(sql<boolean>`lower(name) = 'art'`)
      .execute();
    expect(tags).toHaveLength(1);
    expect(tags[0]?.name).toBe('art');

    const assignments = await db
      .selectFrom('app.tagAssignments')
      .select('id')
      .where('tagId', '=', tags[0]?.id ?? '')
      .execute();
    expect(assignments).toHaveLength(1);
  });
});

// §5: orderNumber is folded into notes on write, so it must be read back out of them.
describe('orderNumber read parity', () => {
  it('reads orderNumber back through search and recent', async () => {
    const up = await callTool(userId, 'finance_transaction_upsert', {
      postedOn: '2026-12-30',
      account: 'Sheet Checking',
      description: 'Example Order Merchant',
      amountCents: -12345,
      currencyCode: 'USD',
      orderNumber: 'ORDER-0001',
    });
    const id = content(up).id ?? '';

    const search = content(
      await callTool(userId, 'finance_transaction_search', { query: 'Example Order Merchant' }),
    );
    const searched = search.transactions?.find((row) => row.id === id);
    expect(searched?.orderNumber).toBe('ORDER-0001');

    const recent = content(await callTool(userId, 'finance_recent_transactions', { limit: 50 }));
    const recentRow = recent.transactions?.find((row) => row.id === id);
    expect(recentRow?.orderNumber).toBe('ORDER-0001');

    const cleared = content(
      await callTool(userId, 'finance_transaction_upsert', {
        postedOn: '2026-12-30',
        account: 'Sheet Checking',
        description: 'Example Order Merchant',
        amountCents: -12345,
        currencyCode: 'USD',
        externalId: 'order-number-clear-test',
        notes: 'Order #: LEGACY-ORDER',
      }),
    );
    await callTool(userId, 'finance_transaction_upsert', {
      postedOn: '2026-12-30',
      account: 'Sheet Checking',
      description: 'Example Order Merchant',
      amountCents: -12345,
      currencyCode: 'USD',
      externalId: 'order-number-clear-test',
      orderNumber: null,
    });
    const clearedSearch = content(
      await callTool(userId, 'finance_transaction_search', { query: 'Example Order Merchant' }),
    );
    expect(
      clearedSearch.transactions?.find((row) => row.id === cleared.id)?.orderNumber,
    ).toBeNull();
    const clearedRecent = content(
      await callTool(userId, 'finance_recent_transactions', { limit: 50 }),
    );
    expect(
      clearedRecent.transactions?.find((row) => row.id === cleared.id)?.orderNumber,
    ).toBeNull();
  });
});
