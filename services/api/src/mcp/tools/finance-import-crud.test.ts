import { db, pool, sql } from '@hominem/db/core';
import { parseSheetTransactionsCsv } from '@hominem/finance-services';
import { beforeAll, describe, expect, it } from 'vitest';

import { callTool, type McpToolResult } from '../tool-registry';
import './finance';

const userId = 'f2000010-0000-4000-8000-000000000001';
const otherUserId = 'f2000010-0000-4000-8000-000000000002';
const checkingId = 'f2000011-0000-4000-8000-000000000001';
const gbpId = 'f2000011-0000-4000-8000-000000000002';

type Content = Record<string, unknown> & {
  categories?: Array<{ id: string; name: string }>;
  count?: number;
  created?: boolean;
  id?: string;
  accountId?: string;
  received?: number;
  upserted?: number;
  createdCount?: number;
  rejected?: Array<{ index: number; reason: string }>;
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
  await db.deleteFrom('app.financeTransactions').where('userId', '=', userId).execute();
  await db.deleteFrom('app.financeCategories').where('userId', '=', userId).execute();
  await db.deleteFrom('app.tags').where('ownerUserid', '=', userId).execute();
  await db.deleteFrom('app.financeAccounts').where('userId', '=', userId).execute();
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

  it('keeps recurring and order number in notes', async () => {
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
      .select(['recurring', 'notes'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    expect(row.recurring).toBe(true);
    expect(row.notes).toContain('Order #: ABC-123');
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
  });
});
