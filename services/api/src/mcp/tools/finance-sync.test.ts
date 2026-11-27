import { db, sql } from '@hominem/db/core';
import {
  removeUsers,
  resetUsers,
  seedAccounts,
  seedCategory,
  seedTag,
} from '@hominem/finance-services/test/factory';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { importSyncDoctrine } from '../../application/finance.doctrine.service';
import { updateFinanceTransactions } from '../../application/finance.transactions-management.service';
import { starlingFeed } from '../../testkit/fixtures/finance-providers';
import { callTool } from '../tool-registry';
import './finance';

const userId = 'f2000134-0000-4000-8000-000000000001';
const otherUserId = 'f2000134-0000-4000-8000-000000000002';
const checkingId = 'f2000135-0000-4000-8000-000000000001';
const cardId = 'f2000135-0000-4000-8000-000000000002';
const otherCheckingId = 'f2000135-0000-4000-8000-000000000003';

beforeEach(async () => {
  await resetUsers(userId, otherUserId);
  await seedAccounts(userId, [
    {
      id: checkingId,
      name: 'Synthetic Current',
      accountType: 'checking',
      provider: 'starling',
      providerAccountId: 'bank-a',
    },
    {
      id: cardId,
      name: 'Synthetic Card',
      accountType: 'credit',
      provider: 'plaid',
      mask: '4242',
    },
    {
      id: otherCheckingId,
      userId: otherUserId,
      name: 'Other Current',
      accountType: 'checking',
      provider: 'starling',
      providerAccountId: 'bank-a',
    },
  ]);
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

afterAll(() => removeUsers(userId, otherUserId));

const windows = { starling_since: '2026-01-01', plaid_since: '2026-01-01', until: '2026-01-05' };

describe('finance_sync', () => {
  it('routes and classifies on the server, preserves provider IDs and never rewrites rows on resync', async () => {
    const input = {
      windows,
      starling: [starlingFeed(), starlingFeed({ feedItemUid: 'feed-2' })],
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
    const category = await seedCategory({ userId, name: 'User category' });
    const tag = await seedTag({ ownerUserid: userId, name: 'User tag' });
    await updateFinanceTransactions(userId, [edited.id], {
      action: 'category',
      categoryId: category.id,
      tagIds: [tag.id],
    });
    await updateFinanceTransactions(userId, [edited.id], { action: 'notes', value: 'User note' });

    const replay = await callTool(userId, 'finance_sync', {
      windows,
      starling: [starlingFeed({ merchant: 'Corrected name', amount: -7 })],
    });
    expect(replay.structuredContent).toMatchObject({
      added: 0,
      updated: 0,
      ok: true,
      warnings: [expect.stringContaining('-700 USD')],
    });
    const stored = await db
      .selectFrom('app.financeTransactions')
      .select(['id', 'amount', 'description', 'categoryId', 'notes'])
      .where('id', '=', edited.id)
      .executeTakeFirstOrThrow();
    expect(stored).toMatchObject({
      description: 'Synth Coffee',
      categoryId: category.id,
      notes: 'User note',
    });
    expect(Number(stored.amount)).toBe(-5);
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
      starling: [starlingFeed(), starlingFeed({ feedItemUid: 'unknown', accountUid: 'not-owned' })],
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
    const input = { windows, starling: [starlingFeed()] };
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

  it('matches a renamed older row instead of adding it twice or renaming it back', async () => {
    await callTool(userId, 'finance_transactions_import', {
      transactions: [
        {
          postedOn: '2026-01-02',
          account: checkingId,
          description: 'My coffee',
          amountCents: -500,
          currencyCode: 'USD',
          source: 'manual',
        },
      ],
    });
    const input = { windows, starling: [starlingFeed()] };
    const first = await callTool(userId, 'finance_sync', input);
    expect(first.structuredContent).toMatchObject({
      added: 0,
      updated: 1,
      warnings: [expect.stringContaining('My coffee')],
    });
    const second = await callTool(userId, 'finance_sync', input);
    expect(second.structuredContent).toMatchObject({ added: 0, updated: 0, warnings: [] });
    expect(
      await db
        .selectFrom('app.financeTransactions')
        .select(['description', 'externalId'])
        .where('userId', '=', userId)
        .execute(),
    ).toEqual([{ description: 'My coffee', externalId: 'feed-1' }]);
  });

  it('adds the second of two identical purchases, even next to one older copy', async () => {
    const older = {
      postedOn: '2026-01-02',
      account: checkingId,
      description: 'Synth Coffee',
      amountCents: -500,
      currencyCode: 'USD',
      source: 'starling',
    };
    await callTool(userId, 'finance_transactions_import', { transactions: [older] });
    const input = { windows, starling: [starlingFeed(), starlingFeed({ feedItemUid: 'feed-2' })] };
    const preview = await callTool(userId, 'finance_sync', { ...input, dryRun: true });
    expect(preview.structuredContent).toMatchObject({ added: 1, updated: 1 });
    const result = await callTool(userId, 'finance_sync', input);
    expect(result.structuredContent).toMatchObject({ added: 1, updated: 1 });

    // The older writer re-pushing its copy must not create a third row.
    for (const dryRun of [true, false]) {
      const repush = await callTool(userId, 'finance_transactions_import', {
        transactions: [older],
        dryRun,
      });
      expect(repush.structuredContent).toMatchObject({ created: 0, updated: 0 });
    }
    expect(
      await db
        .selectFrom('app.financeTransactions')
        .select('externalId')
        .where('userId', '=', userId)
        .orderBy('externalId')
        .execute(),
    ).toEqual([{ externalId: 'feed-1' }, { externalId: 'feed-2' }]);
  });

  it('stays duplicate-free when two syncs run at once', async () => {
    const input = { windows, starling: [starlingFeed(), starlingFeed({ feedItemUid: 'feed-2' })] };
    await Promise.all([
      callTool(userId, 'finance_sync', input),
      callTool(userId, 'finance_sync', input),
    ]);
    expect(
      await db
        .selectFrom('app.financeTransactions')
        .select('id')
        .where('userId', '=', userId)
        .execute(),
    ).toHaveLength(2);
  });

  it('links unambiguous transfers without rewriting annotations', async () => {
    const result = await callTool(userId, 'finance_sync', {
      windows,
      starling: [
        starlingFeed({ feedItemUid: 'transfer-a', merchant: 'Synth Transfer', amount: 10 }),
      ],
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
        starlingFeed({ feedItemUid: 'transfer-a', merchant: 'Synth Transfer', amount: 10 }),
        starlingFeed({ feedItemUid: 'transfer-b', merchant: 'Synth Transfer', amount: 10 }),
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
