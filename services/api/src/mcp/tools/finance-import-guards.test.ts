import { db, pool } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { callTool, getToolDefinition, type McpToolResult } from '../tool-registry';
import './finance';

type Content = Record<string, unknown> & {
  received?: number;
  upserted?: number;
  created?: number;
  updated?: number;
  rejected?: Array<{ index: number; reason: string }>;
};

function content(res: McpToolResult<Content>): Content {
  return res.structuredContent ?? {};
}

const guardUser = 'f2000000-0000-4000-8000-000000000101';
const allowUser = 'f2000000-0000-4000-8000-000000000102';
const multiUser = 'f2000000-0000-4000-8000-000000000103';
const guardCheckingId = 'f2000003-0000-4000-8000-000000000101';
const allowCheckingId = 'f2000003-0000-4000-8000-000000000102';
const multiCheckingId = 'f2000003-0000-4000-8000-000000000103';

async function seedUser(userId: string, accountId: string, currency = 'USD') {
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
    [userId, `Guard User ${userId}`, `${userId}@test.hominem.dev`, true],
  );
  await db.deleteFrom('app.financeTransactions').where('userId', '=', userId).execute();
  await db.deleteFrom('app.financeCategories').where('userId', '=', userId).execute();
  await db.deleteFrom('app.tags').where('ownerUserid', '=', userId).execute();
  await db.deleteFrom('app.financeAccounts').where('userId', '=', userId).execute();
  await db
    .insertInto('app.financeAccounts')
    .values({
      id: accountId,
      userId,
      name: 'Guard Checking',
      accountType: 'checking',
      currencyCode: currency,
      lifecycleStatus: 'open',
      includeInNetWorth: true,
      metadata: {},
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();
}

const oneRow = (account: string) => ({
  postedOn: '2026-11-01',
  account,
  description: 'Guard Row',
  amountCents: -100,
  currencyCode: 'USD',
});

beforeAll(async () => {
  await seedUser(guardUser, guardCheckingId);
  await seedUser(allowUser, allowCheckingId);
  await seedUser(multiUser, multiCheckingId);
});

describe('replace guards', () => {
  it('refuses replace without iUnderstand', async () => {
    await expect(
      callTool(guardUser, 'finance_transactions_import', {
        mode: 'replace',
        transactions: [oneRow('Guard Checking')],
      }),
    ).rejects.toThrow(/requires iUnderstand/);
  });

  it('replaces with iUnderstand and a fully valid payload, with no prior dry run', async () => {
    await callTool(guardUser, 'finance_transactions_import', {
      mode: 'append',
      transactions: [oneRow('Guard Checking')],
    });
    const replaced = await callTool(guardUser, 'finance_transactions_import', {
      mode: 'replace',
      iUnderstand: true,
      transactions: [oneRow('Guard Checking')],
    });
    expect(content(replaced)).toMatchObject({ received: 1, upserted: 1, created: 1 });
    const rows = await db
      .selectFrom('app.financeTransactions')
      .select('description')
      .where('userId', '=', guardUser)
      .execute();
    expect(rows.map((row) => row.description)).toEqual(['Guard Row']);
  });

  it('refuses replace when any row would be rejected, without wiping', async () => {
    await callTool(multiUser, 'finance_transactions_import', {
      mode: 'append',
      transactions: [oneRow('Guard Checking')],
    });
    await expect(
      callTool(multiUser, 'finance_transactions_import', {
        mode: 'replace',
        iUnderstand: true,
        transactions: [oneRow('Guard Checking'), oneRow('Missing Bank …0000')],
      }),
    ).rejects.toThrow(/would be rejected/);
    const survivors = await db
      .selectFrom('app.financeTransactions')
      .select('description')
      .where('userId', '=', multiUser)
      .execute();
    expect(survivors.map((row) => row.description)).toEqual(['Guard Row']);
  });
});

describe('pending rows', () => {
  it('rejects pending rows loudly in batch and single paths', async () => {
    const batch = await callTool(allowUser, 'finance_transactions_import', {
      mode: 'append',
      transactions: [
        oneRow('Guard Checking'),
        { ...oneRow('Guard Checking'), description: 'Pending Coffee', pending: true },
      ],
    });
    expect(content(batch)).toMatchObject({ received: 2, upserted: 1, created: 1 });
    expect(content(batch).rejected).toEqual([{ index: 1, reason: 'pending_row' }]);
    const single = await callTool(allowUser, 'finance_transaction_upsert', {
      ...oneRow('Guard Checking'),
      pending: true,
    });
    expect(content(single)).toMatchObject({ id: null, reason: 'pending_row' });
  });
});

describe('replace confirmation (B5)', () => {
  it('skips the elicitation when iUnderstand or a dry run already confirms', async () => {
    const definition = getToolDefinition('finance_transactions_import');
    expect(definition?.preview).toBeTypeOf('function');
    const preview = definition!.preview!;
    const row = oneRow('Guard Checking');
    // Non-null preview => the server elicits; null => it proceeds without one.
    expect(await preview(guardUser, { mode: 'replace', transactions: [row] })).not.toBeNull();
    expect(
      await preview(guardUser, { mode: 'replace', iUnderstand: true, transactions: [row] }),
    ).toBeNull();
    expect(
      await preview(guardUser, { mode: 'replace', dryRun: true, transactions: [row] }),
    ).toBeNull();
    expect(await preview(guardUser, { mode: 'append', transactions: [row] })).toBeNull();
  });
});

describe('multi-currency allowlist', () => {
  const gbpRow = {
    postedOn: '2026-11-02',
    account: 'Guard Checking',
    description: 'London Spend',
    amountCents: -5000,
    currencyCode: 'GBP',
  };

  it('rejects cross-currency rows without the allowlist', async () => {
    const result = await callTool(multiUser, 'finance_transactions_import', {
      mode: 'append',
      transactions: [gbpRow],
    });
    expect(content(result).rejected).toEqual([{ index: 0, reason: 'currency_mismatch' }]);
  });

  it('accepts either currency for an allowlisted account by label or id', async () => {
    for (const entry of ['Guard Checking', multiCheckingId]) {
      const result = await callTool(multiUser, 'finance_transactions_import', {
        mode: 'append',
        multiCurrencyAccounts: [entry],
        transactions: [{ ...gbpRow, description: `London Spend ${entry.slice(-4)}` }],
      });
      expect(content(result).rejected).toEqual([]);
      expect(content(result).created).toBe(1);
    }
  });
});
