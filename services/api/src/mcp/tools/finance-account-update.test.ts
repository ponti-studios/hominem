import { db, pool } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { callTool, type McpToolResult } from '../tool-registry';
import './finance';

const userId = 'f2000100-0000-4000-8000-000000000001';
const otherUserId = 'f2000100-0000-4000-8000-000000000002';
const typoId = 'f2000101-0000-4000-8000-000000000001';
const appleId = 'f2000101-0000-4000-8000-000000000002';
const probeId = 'f2000101-0000-4000-8000-000000000003';
const otherAccountId = 'f2000101-0000-4000-8000-000000000004';

type Content = {
  id?: string | null;
  name?: string | null;
  currencyCode?: string | null;
  status?: string | null;
  updated?: boolean;
  changes?: Record<string, [string | null, string | null]>;
  reason?: string | null;
  accounts?: Array<{
    id?: string;
    accountId?: string;
    accountName?: string;
    name?: string;
    lifecycleStatus?: string;
    transactionCount?: number;
  }>;
  transactionCount?: number;
};

function content(res: McpToolResult<Content>): Content {
  return res.structuredContent ?? {};
}

function account(
  id: string,
  owner: string,
  name: string,
  lifecycleStatus: string,
  type = 'checking',
) {
  return {
    id,
    userId: owner,
    name,
    accountType: type,
    currencyCode: 'USD',
    lifecycleStatus,
    includeInNetWorth: lifecycleStatus === 'open',
    metadata: {},
  };
}

async function nameOf(id: string): Promise<string | undefined> {
  const row = await db
    .selectFrom('app.financeAccounts')
    .select('name')
    .where('id', '=', id)
    .executeTakeFirst();
  return row?.name;
}

beforeAll(async () => {
  for (const id of [userId, otherUserId]) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, `Account Update User ${id}`, `${id}@test.hominem.dev`, true],
    );
    await db.deleteFrom('app.financeAccounts').where('userId', '=', id).execute();
  }

  await db
    .insertInto('app.financeAccounts')
    .values([
      account(typoId, userId, 'Exmaple Broker', 'open'),
      account(appleId, userId, 'Example Savings', 'open', 'savings'),
      account(probeId, userId, 'ZZZ Probe Account', 'closed'),
      account(otherAccountId, otherUserId, 'Other Account', 'open'),
    ])
    .execute();

  await db
    .insertInto('app.financeTransactions')
    .values({
      id: 'f2000102-0000-4000-8000-000000000001',
      userId,
      accountId: typoId,
      postedOn: '2026-07-01',
      description: 'Kept row',
      amount: -1234,
      currencyCode: 'USD',
      transactionType: 'debit',
      pending: false,
      excluded: false,
      externalId: 'acct-update-ext-1',
      providerPayload: {},
    })
    .execute();
});

describe('finance_account_update', () => {
  it('fixes a name typo and keeps the account identity and its history', async () => {
    const before = content(
      await callTool(userId, 'finance_account_summary', { accountId: typoId }),
    );

    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: typoId,
        name: 'Example Broker',
      }),
    );
    expect(result.reason).toBeNull();
    expect(result.updated).toBe(true);
    expect(result.id).toBe(typoId);
    expect(result.changes).toEqual({ name: ['Exmaple Broker', 'Example Broker'] });
    expect(await nameOf(typoId)).toBe('Example Broker');

    const after = content(await callTool(userId, 'finance_account_summary', { accountId: typoId }));
    expect(after.accounts?.[0]).toMatchObject({ accountId: typoId, accountName: 'Example Broker' });
    expect(after.accounts?.[0]?.transactionCount).toBe(before.accounts?.[0]?.transactionCount);
  });

  it('refuses a rename that clashes with another account', async () => {
    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: appleId,
        name: 'example broker',
      }),
    );
    expect(result.reason).toBe('name_conflict');
    expect(await nameOf(appleId)).toBe('Example Savings');
    expect(await nameOf(typoId)).toBe('Example Broker');
  });

  it('allows re-casing the account’s own name', async () => {
    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: appleId,
        name: 'example savings',
      }),
    );
    expect(result.reason).toBeNull();
    expect(result.updated).toBe(true);
    expect(result.changes).toEqual({ name: ['Example Savings', 'example savings'] });
  });

  it('reports a no-op as updated: false with an empty change set', async () => {
    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: appleId,
        name: 'example savings',
      }),
    );
    expect(result.reason).toBeNull();
    expect(result.updated).toBe(false);
    expect(result.changes).toEqual({});
  });

  it('round-trips status and respects the closed-visibility rule', async () => {
    const opened = content(
      await callTool(userId, 'finance_account_update', { accountId: probeId, status: 'open' }),
    );
    expect(opened.changes).toEqual({ status: ['closed', 'open'] });

    const defaultView = content(await callTool(userId, 'finance_accounts', {}));
    expect(defaultView.accounts?.some((row) => row.id === probeId)).toBe(true);

    const closed = content(
      await callTool(userId, 'finance_account_update', { accountId: probeId, status: 'closed' }),
    );
    expect(closed.changes).toEqual({ status: ['open', 'closed'] });

    const afterClose = content(await callTool(userId, 'finance_accounts', {}));
    expect(afterClose.accounts?.some((row) => row.id === probeId)).toBe(false);
    const withClosed = content(await callTool(userId, 'finance_accounts', { includeClosed: true }));
    expect(withClosed.accounts?.some((row) => row.id === probeId)).toBe(true);
  });

  it('projects a dry run without applying it', async () => {
    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: appleId,
        name: 'Example Savings',
        dryRun: true,
      }),
    );
    expect(result.updated).toBe(true);
    expect(result.changes).toEqual({ name: ['example savings', 'Example Savings'] });
    expect(await nameOf(appleId)).toBe('example savings');
  });

  it('refuses a currency change and a blank name', async () => {
    const currency = content(
      await callTool(userId, 'finance_account_update', { accountId: appleId, currencyCode: 'GBP' }),
    );
    expect(currency.reason).toBe('currency_immutable');

    const blank = content(
      await callTool(userId, 'finance_account_update', { accountId: appleId, name: '   ' }),
    );
    expect(blank.reason).toBe('invalid_name');
  });

  it('sets and clears the institution and mask', async () => {
    const set = content(
      await callTool(userId, 'finance_account_update', {
        accountId: appleId,
        institution: 'Example Bank',
        accountNumber: '0895',
      }),
    );
    expect(set.updated).toBe(true);
    expect(set.changes?.institution).toEqual([null, 'Example Bank']);
    expect(set.changes?.accountNumber).toEqual([null, '0895']);

    const cleared = content(
      await callTool(userId, 'finance_account_update', {
        accountId: appleId,
        institution: null,
        accountNumber: null,
      }),
    );
    expect(cleared.changes?.institution).toEqual(['Example Bank', null]);
    expect(cleared.changes?.accountNumber).toEqual(['0895', null]);
  });

  it('never updates another user’s account', async () => {
    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: otherAccountId,
        name: 'Hijacked',
      }),
    );
    expect(result.reason).toBe('unknown_account');
    expect(await nameOf(otherAccountId)).toBe('Other Account');
  });

  it('reports an unknown account id', async () => {
    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: 'f2000109-0000-4000-8000-000000000009',
        name: 'Nope',
      }),
    );
    expect(result.reason).toBe('unknown_account');
  });
});
