import { db, pool, sql } from '@hominem/db/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { importSyncDoctrine } from '../../application/finance.doctrine.service';
import { updateFinanceTransactions } from '../../application/finance.transactions-management.service';
import { callTool } from '../tool-registry';
import './finance';

const userId = 'f2000130-0000-4000-8000-000000000001';
const otherUserId = 'f2000130-0000-4000-8000-000000000002';
const checkingId = 'f2000131-0000-4000-8000-000000000001';
const cardId = 'f2000131-0000-4000-8000-000000000002';
const otherCheckingId = 'f2000131-0000-4000-8000-000000000003';

async function clear() {
  for (const id of [userId, otherUserId]) {
    await db
      .deleteFrom('app.tagAssignments')
      .where('tagId', 'in', db.selectFrom('app.tags').select('id').where('ownerUserid', '=', id))
      .execute();
    await db.deleteFrom('app.financeTransactions').where('userId', '=', id).execute();
    await db.deleteFrom('app.financeCategories').where('userId', '=', id).execute();
    await db.deleteFrom('app.tags').where('ownerUserid', '=', id).execute();
    await db.deleteFrom('app.financeAccounts').where('userId', '=', id).execute();
    await db.deleteFrom('app.financeSyncDoctrine').where('userId', '=', id).execute();
  }
}

beforeAll(async () => {
  for (const id of [userId, otherUserId]) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true) ON CONFLICT (id) DO NOTHING`,
      [id, 'Sync Fixture', `${id}@test.hominem.dev`],
    );
  }
});

beforeEach(async () => {
  await clear();
  await db
    .insertInto('app.financeAccounts')
    .values([
      {
        id: checkingId,
        userId,
        name: 'Synthetic Current',
        accountType: 'checking',
        currencyCode: 'USD',
        provider: 'starling',
        providerAccountId: 'bank-a',
        metadata: {},
      },
      {
        id: cardId,
        userId,
        name: 'Synthetic Card',
        accountType: 'credit',
        currencyCode: 'USD',
        provider: 'plaid',
        mask: '4242',
        metadata: {},
      },
      {
        id: otherCheckingId,
        userId: otherUserId,
        name: 'Other Current',
        accountType: 'checking',
        currencyCode: 'USD',
        provider: 'starling',
        providerAccountId: 'bank-a',
        metadata: {},
      },
    ])
    .execute();
  await importSyncDoctrine(userId, {
    doctrine: {
      version: 1,
      merchantRules: [{ pattern: 'synth coffee', category: 'Food' }],
      tagRules: [{ pattern: 'synth coffee', tags: ['Coffee'] }],
      amountRules: [],
      transferMerchants: [{ pattern: 'synth transfer' }],
      incomePatterns: [],
      coffeePatterns: ['coffee'],
      lenses: [],
    },
  });
});

afterAll(async () => {
  await clear();
  await pool.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [[userId, otherUserId]]);
});

const windows = { starling_since: '2026-01-01', plaid_since: '2026-01-01', until: '2026-01-05' };

function starling(
  overrides: Partial<{
    feedItemUid: string;
    merchant: string;
    amount: number;
    accountUid: string;
  }> = {},
) {
  const item = {
    feedItemUid: 'feed-1',
    date: '2026-01-02',
    merchant: 'Synth Coffee',
    amount: -5,
    currency: 'USD',
    accountUid: 'bank-a',
    ...overrides,
  };
  return {
    accountUid: item.accountUid,
    currency: item.currency,
    space: null,
    feedItems: [
      {
        feedItemUid: item.feedItemUid,
        transactionTime: `${item.date}T12:00:00Z`,
        counterPartyName: item.merchant,
        amount: { minorUnits: Math.round(Math.abs(item.amount) * 100), currency: item.currency },
        direction: item.amount < 0 ? 'OUT' : 'IN',
        status: 'SETTLED',
      },
    ],
  };
}

describe('finance_sync', () => {
  it('routes and classifies on the server, preserves provider IDs and user edits on resync', async () => {
    const input = {
      windows,
      starling: [starling(), starling({ feedItemUid: 'feed-2' })],
      plaid: {
        accounts: [{ account_id: 'p-account', name: 'Card', mask: '4242' }],
        transactions: [
          {
            account_id: 'p-account',
            transaction_id: 'plaid-1',
            date: '2026-01-03',
            name: 'Synthetic purchase',
            amount: 3,
            iso_currency_code: 'USD',
          },
        ],
      },
    };
    const preview = await callTool(userId, 'finance_sync', { ...input, dryRun: true });
    expect(preview.structuredContent).toMatchObject({ added: 3, dryRun: true, held: [] });
    expect(
      await db
        .selectFrom('app.financeTransactions')
        .select('id')
        .where('userId', '=', userId)
        .execute(),
    ).toHaveLength(0);

    const result = await callTool(userId, 'finance_sync', input);
    expect(result.structuredContent).toMatchObject({
      ok: true,
      added: 3,
      updated: 0,
      by_source: { 'Starling API': 2, Plaid: 1 },
    });
    const rows = await db
      .selectFrom('app.financeTransactions')
      .select(['id', 'externalId', 'accountId', 'categoryId'])
      .where('userId', '=', userId)
      .execute();
    expect(rows.map((row) => row.externalId).sort()).toEqual(['feed-1', 'feed-2', 'plaid-1']);
    const edited = rows.find((row) => row.externalId === 'feed-1')!;
    const category = await db
      .insertInto('app.financeCategories')
      .values({ userId, name: 'User category' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const tag = await db
      .insertInto('app.tags')
      .values({ ownerUserid: userId, name: 'User tag', slug: 'user-tag', path: 'user-tag' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await updateFinanceTransactions(userId, [edited.id], {
      action: 'category',
      categoryId: category.id,
      tagIds: [tag.id],
    });
    await updateFinanceTransactions(userId, [edited.id], { action: 'notes', value: 'User note' });

    const replay = await callTool(userId, 'finance_sync', {
      windows,
      starling: [starling({ merchant: 'Corrected name', amount: -7 })],
    });
    expect(replay.structuredContent).toMatchObject({ added: 0, updated: 1, ok: true });
    const stored = await db
      .selectFrom('app.financeTransactions')
      .select(['id', 'amount', 'description', 'categoryId', 'notes'])
      .where('id', '=', edited.id)
      .executeTakeFirstOrThrow();
    expect(stored).toMatchObject({
      description: 'Corrected name',
      categoryId: category.id,
      notes: 'User note',
    });
    expect(Number(stored.amount)).toBe(-7);
    expect(
      await db
        .selectFrom('app.tagAssignments')
        .select('tagId')
        .where('entityId', '=', edited.id)
        .execute(),
    ).toEqual([{ tagId: tag.id }]);
  });

  it('holds unknown and ambiguous identities without reading another owner’s accounts', async () => {
    const result = await callTool(otherUserId, 'finance_sync', {
      windows,
      starling: [starling(), starling({ feedItemUid: 'unknown', accountUid: 'not-owned' })],
      plaid: {
        accounts: [{ account_id: 'p-account', name: 'Card', mask: '4242' }],
        transactions: [
          {
            account_id: 'p-account',
            transaction_id: 'plaid-1',
            date: '2026-01-03',
            name: 'Synthetic purchase',
            amount: 3,
            iso_currency_code: 'USD',
          },
        ],
      },
    });
    expect(result.structuredContent).toMatchObject({
      added: 1,
      held: [
        expect.objectContaining({ externalId: 'unknown' }),
        expect.objectContaining({ externalId: 'plaid-1' }),
      ],
    });
    const rows = await db
      .selectFrom('app.financeTransactions')
      .select(['accountId'])
      .where('userId', '=', otherUserId)
      .execute();
    expect(rows).toEqual([{ accountId: otherCheckingId }]);
    expect(
      await db
        .selectFrom('app.financeTransactions')
        .select('id')
        .where('userId', '=', userId)
        .execute(),
    ).toHaveLength(0);
  });

  it('adopts an existing natural-key provider row before applying its stable ID', async () => {
    await callTool(userId, 'finance_transactions_import', {
      transactions: [
        {
          postedOn: '2026-01-02',
          account: checkingId,
          description: 'Synth Coffee',
          amountCents: -500,
          currencyCode: 'USD',
          source: 'starling',
          category: 'Previous category',
          notes: 'Existing note',
        },
      ],
    });
    const before = await db
      .selectFrom('app.financeTransactions')
      .select(['id', 'categoryId', 'notes'])
      .where('userId', '=', userId)
      .executeTakeFirstOrThrow();
    const input = { windows, starling: [starling()] };
    const preview = await callTool(userId, 'finance_sync', { ...input, dryRun: true });
    expect(preview.structuredContent).toMatchObject({ added: 0, updated: 1 });
    const result = await callTool(userId, 'finance_sync', input);
    expect(result.structuredContent).toMatchObject({ added: 0, updated: 1 });
    const after = await db
      .selectFrom('app.financeTransactions')
      .select(['id', 'externalId', 'categoryId', 'notes'])
      .where('userId', '=', userId)
      .execute();
    expect(after).toEqual([{ ...before, externalId: 'feed-1' }]);
  });

  it('links unambiguous transfers without rewriting annotations', async () => {
    const result = await callTool(userId, 'finance_sync', {
      windows,
      starling: [starling({ feedItemUid: 'transfer-a', merchant: 'Synth Transfer', amount: 10 })],
      plaid: {
        accounts: [{ account_id: 'p-account', name: 'Card', mask: '4242' }],
        transactions: [
          {
            account_id: 'p-account',
            transaction_id: 'transfer-b',
            date: '2026-01-02',
            name: 'Synth Transfer',
            amount: 10,
            iso_currency_code: 'USD',
          },
        ],
      },
    });
    expect(result.structuredContent).toMatchObject({ added: 2, linked: [expect.any(String)] });
    const rows = await db
      .selectFrom('app.financeTransactions')
      .select(['id', 'counterpartId'])
      .where('userId', '=', userId)
      .orderBy(sql`external_id`)
      .execute();
    expect(rows).toHaveLength(2);
    expect(rows[0].counterpartId).toBe(rows[1].id);
    expect(rows[1].counterpartId).toBe(rows[0].id);
  });

  it('leaves ambiguous transfer candidates unlinked', async () => {
    const result = await callTool(userId, 'finance_sync', {
      windows,
      starling: [
        starling({ feedItemUid: 'transfer-a', merchant: 'Synth Transfer', amount: 10 }),
        starling({ feedItemUid: 'transfer-b', merchant: 'Synth Transfer', amount: 10 }),
      ],
      plaid: {
        accounts: [{ account_id: 'p-account', name: 'Card', mask: '4242' }],
        transactions: ['transfer-c'].map((transaction_id) => ({
          account_id: 'p-account',
          transaction_id,
          date: '2026-01-02',
          name: 'Synth Transfer',
          amount: 10,
          iso_currency_code: 'USD',
        })),
      },
    });
    expect(result.structuredContent).toMatchObject({ added: 3, linked: [] });
    const rows = await db
      .selectFrom('app.financeTransactions')
      .select('counterpartId')
      .where('userId', '=', userId)
      .execute();
    expect(rows).toEqual(Array.from({ length: 3 }, () => ({ counterpartId: null })));
  });
});
