import { db, pool } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { callTool, type McpToolResult } from '../tool-registry';
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
    ).rejects.toThrow('replace_requires_confirmation');
  });

  it('refuses replace without a prior session dry run', async () => {
    await expect(
      callTool(guardUser, 'finance_transactions_import', {
        mode: 'replace',
        iUnderstand: true,
        transactions: [oneRow('Guard Checking')],
      }),
    ).rejects.toThrow('replace_requires_dry_run');
  });

  it('refuses replace after a dry run that had rejections', async () => {
    await callTool(guardUser, 'finance_transactions_import', {
      mode: 'append',
      dryRun: true,
      transactions: [oneRow('Guard Checking'), oneRow('Missing Bank …0000')],
    });
    await expect(
      callTool(guardUser, 'finance_transactions_import', {
        mode: 'replace',
        iUnderstand: true,
        transactions: [oneRow('Guard Checking')],
      }),
    ).rejects.toThrow('replace_requires_dry_run');
  });

  it('allows replace after a clean dry run, then disarms', async () => {
    const dry = await callTool(guardUser, 'finance_transactions_import', {
      mode: 'append',
      dryRun: true,
      transactions: [oneRow('Guard Checking')],
    });
    expect(content(dry).rejected).toEqual([]);
    const replaced = await callTool(guardUser, 'finance_transactions_import', {
      mode: 'replace',
      iUnderstand: true,
      transactions: [oneRow('Guard Checking')],
    });
    expect(content(replaced)).toMatchObject({ received: 1, created: 1 });
    await expect(
      callTool(guardUser, 'finance_transactions_import', {
        mode: 'replace',
        iUnderstand: true,
        transactions: [oneRow('Guard Checking')],
      }),
    ).rejects.toThrow('replace_requires_dry_run');
  });

  it('refuses replace when the payload differs from the dry run, without wiping', async () => {
    const seeded = await callTool(multiUser, 'finance_transactions_import', {
      mode: 'append',
      transactions: [oneRow('Guard Checking')],
    });
    expect(content(seeded).created).toBe(1);
    const otherRow = { ...oneRow('Guard Checking'), description: 'Different Row' };
    await callTool(multiUser, 'finance_transactions_import', {
      mode: 'append',
      dryRun: true,
      transactions: [oneRow('Guard Checking')],
    });
    await expect(
      callTool(multiUser, 'finance_transactions_import', {
        mode: 'replace',
        iUnderstand: true,
        transactions: [otherRow],
      }),
    ).rejects.toThrow('replace_payload_mismatch');
    const survivors = await db
      .selectFrom('app.financeTransactions')
      .select('description')
      .where('userId', '=', multiUser)
      .execute();
    expect(survivors.map((row) => row.description)).toEqual(['Guard Row']);
  });

  it('refuses replace when the options differ from the dry run', async () => {
    await callTool(allowUser, 'finance_transactions_import', {
      mode: 'append',
      dryRun: true,
      transactions: [oneRow('Guard Checking')],
    });
    await expect(
      callTool(allowUser, 'finance_transactions_import', {
        mode: 'replace',
        iUnderstand: true,
        multiCurrencyAccounts: ['Guard Checking'],
        transactions: [oneRow('Guard Checking')],
      }),
    ).rejects.toThrow('replace_payload_mismatch');
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
    await expect(
      callTool(allowUser, 'finance_transaction_upsert', {
        ...oneRow('Guard Checking'),
        pending: true,
      }),
    ).rejects.toThrow('pending_row');
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
