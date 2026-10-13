import { db, pool } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { callTool, type McpToolResult } from '../tool-registry';
import './finance';

const userId = 'f20000f0-0000-4000-8000-000000000001';
const checkingId = 'f20000f1-0000-4000-8000-000000000001';
const savingsId = 'f20000f1-0000-4000-8000-000000000002';

type Content = {
  id?: string | null;
  reason?: string | null;
  counterpartId?: string | null;
  transactions?: Array<Record<string, unknown>>;
  rejected?: Array<{ index: number; reason: string }>;
  created?: number;
  deleted?: unknown[];
};

function content(res: McpToolResult<Content>): Content {
  return res.structuredContent ?? {};
}

async function counterpartOf(id: string): Promise<string | null> {
  const row = await db
    .selectFrom('app.financeTransactions')
    .select('counterpartId')
    .where('id', '=', id)
    .executeTakeFirstOrThrow();
  return row.counterpartId;
}

async function upsert(account: string, description: string, extra?: Record<string, unknown>) {
  return content(
    await callTool(userId, 'finance_transaction_upsert', {
      postedOn: '2026-05-08',
      account,
      description,
      amountCents: -991756,
      currencyCode: 'USD',
      ...extra,
    }),
  );
}

beforeAll(async () => {
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
    [userId, `Counterpart User ${userId}`, `${userId}@test.hominem.dev`, true],
  );
  await db.deleteFrom('app.financeAccounts').where('userId', '=', userId).execute();

  await db
    .insertInto('app.financeAccounts')
    .values([
      {
        id: checkingId,
        userId,
        name: 'Counterpart Checking',
        accountType: 'checking',
        currencyCode: 'USD',
        lifecycleStatus: 'open',
        includeInNetWorth: true,
        metadata: {},
      },
      {
        id: savingsId,
        userId,
        name: 'Counterpart Savings',
        accountType: 'savings',
        currencyCode: 'USD',
        lifecycleStatus: 'open',
        includeInNetWorth: true,
        metadata: {},
      },
    ])
    .execute();
});

describe('transfer counterpart linking', () => {
  it('mirrors the link on both rows and reads it back', async () => {
    const other = await upsert('Counterpart Savings', 'Deposit');
    const leg = await upsert('Counterpart Checking', 'Transfer -> Savings', {
      counterpartId: other.id,
    });
    expect(leg.reason).toBeNull();

    expect(await counterpartOf(leg.id ?? '')).toBe(other.id);
    expect(await counterpartOf(other.id ?? '')).toBe(leg.id);

    const search = content(
      await callTool(userId, 'finance_transaction_search', { query: 'Transfer -> Savings' }),
    );
    const row = search.transactions?.find((t) => t.id === leg.id);
    expect(row?.counterpartId).toBe(other.id);
  });

  it('rejects a counterpart on the same account', async () => {
    const sameAccount = await upsert('Counterpart Checking', 'Same Account Row');
    const result = await upsert('Counterpart Checking', 'Same Account Link', {
      counterpartId: sameAccount.id,
    });
    expect(result.reason).toBe('invalid_counterpart');
    expect(result.id).toBeNull();
  });

  it('rejects a counterpart that does not exist', async () => {
    const result = await upsert('Counterpart Checking', 'Missing Link', {
      counterpartId: 'f20000f9-0000-4000-8000-000000000009',
    });
    expect(result.reason).toBe('invalid_counterpart');
  });

  it('clears the counterpart link when a leg is deleted', async () => {
    const other = await upsert('Counterpart Savings', 'Delete Deposit');
    const leg = await upsert('Counterpart Checking', 'Delete Leg', { counterpartId: other.id });
    expect(await counterpartOf(other.id ?? '')).toBe(leg.id);

    await callTool(userId, 'finance_transaction_delete', {
      ids: [leg.id ?? ''],
      iUnderstand: true,
    });
    expect(await counterpartOf(other.id ?? '')).toBeNull();
  });

  it('surfaces an invalid counterpart as a per-row rejection in a dry run', async () => {
    const dry = content(
      await callTool(userId, 'finance_transactions_import', {
        mode: 'append',
        dryRun: true,
        transactions: [
          {
            postedOn: '2026-05-09',
            account: 'Counterpart Checking',
            description: 'Dry Bad Link',
            amountCents: -100,
            currencyCode: 'USD',
            counterpartId: 'f20000f9-0000-4000-8000-000000000009',
          },
        ],
      }),
    );
    expect(dry.created).toBe(0);
    expect(dry.rejected).toEqual([{ index: 0, reason: 'invalid_counterpart' }]);
  });
});
