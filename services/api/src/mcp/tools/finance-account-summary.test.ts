import { db, pool } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { callTool, type McpToolResult } from '../tool-registry';
import './finance';

const userId = 'f20000b0-0000-4000-8000-000000000001';
const otherUserId = 'f20000b0-0000-4000-8000-000000000002';
const checkingId = 'f20000b1-0000-4000-8000-000000000001';
const savingsId = 'f20000b1-0000-4000-8000-000000000002';
const closedId = 'f20000b1-0000-4000-8000-000000000003';

type SummaryAccount = {
  accountId: string;
  accountName: string;
  status: string;
  transactionCount: number;
  excludedCount: number;
  totals: Array<{ currencyCode: string; sum: number }>;
  minPostedOn: string | null;
  maxPostedOn: string | null;
};

type SummaryContent = {
  accounts?: SummaryAccount[];
  count?: number;
  totalCount?: number;
};

function content(res: McpToolResult<SummaryContent>): SummaryContent {
  return res.structuredContent ?? {};
}

function account(id: string, name: string, lifecycleStatus: string) {
  return {
    id,
    userId,
    name,
    accountType: 'checking',
    currencyCode: 'USD',
    lifecycleStatus,
    includeInNetWorth: lifecycleStatus === 'open',
    metadata: {},
  };
}

function tx(
  id: string,
  accountId: string,
  postedOn: string,
  amount: number,
  options?: { currencyCode?: string; excluded?: boolean },
) {
  return {
    id,
    userId,
    accountId,
    postedOn,
    description: 'Row',
    amount,
    currencyCode: options?.currencyCode ?? 'USD',
    transactionType: 'debit',
    pending: false,
    externalId: `ext-${id}`,
    categoryId: null,
    excluded: options?.excluded ?? false,
    providerPayload: {},
  };
}

beforeAll(async () => {
  for (const id of [userId, otherUserId]) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, `Summary User ${id}`, `${id}@test.hominem.dev`, true],
    );
    // Cascades to accounts and transactions.
    await db.deleteFrom('app.financeAccounts').where('userId', '=', id).execute();
  }

  await db
    .insertInto('app.financeAccounts')
    .values([
      account(checkingId, 'Summary Checking', 'open'),
      account(savingsId, 'Summary Savings', 'open'),
      account(closedId, 'Summary Closed', 'closed'),
    ])
    .execute();

  await db
    .insertInto('app.financeTransactions')
    .values([
      tx('f20000b2-0000-4000-8000-000000000001', checkingId, '2026-01-05', -10),
      tx('f20000b2-0000-4000-8000-000000000002', checkingId, '2026-02-10', -25),
      tx('f20000b2-0000-4000-8000-000000000003', checkingId, '2026-03-01', -5, {
        excluded: true,
      }),
      tx('f20000b2-0000-4000-8000-000000000004', checkingId, '2026-03-02', -7, {
        currencyCode: 'GBP',
      }),
      tx('f20000b2-0000-4000-8000-000000000005', savingsId, '2026-04-01', 50),
    ])
    .execute();
});

describe('finance_account_summary', () => {
  it('reports per-account counts, grouped totals and the posted-on span', async () => {
    const result = content(await callTool(userId, 'finance_account_summary', {}));
    const checking = result.accounts?.find((row) => row.accountId === checkingId);

    expect(checking).toMatchObject({
      accountName: 'Summary Checking',
      allowedCurrencies: ['USD'],
      status: 'open',
      transactionCount: 4,
      excludedCount: 1,
      minPostedOn: '2026-01-05',
      maxPostedOn: '2026-03-02',
    });
    // Grouped by currency — USD and GBP are never collapsed into one meaningless total.
    expect(checking?.totals).toEqual([
      { currencyCode: 'GBP', sum: -7 },
      { currencyCode: 'USD', sum: -40 },
    ]);
  });

  it('includes closed accounts by default and drops them on request', async () => {
    const all = content(await callTool(userId, 'finance_account_summary', {}));
    expect(all.accounts?.some((row) => row.accountId === closedId)).toBe(true);

    const openOnly = content(
      await callTool(userId, 'finance_account_summary', { includeClosed: false }),
    );
    expect(openOnly.accounts?.some((row) => row.accountId === closedId)).toBe(false);
  });

  it('restricts to one account when accountId is given', async () => {
    const result = content(
      await callTool(userId, 'finance_account_summary', { accountId: savingsId }),
    );
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts?.[0]).toMatchObject({ accountId: savingsId, transactionCount: 1 });
  });

  it("returns not-found for another user's account", async () => {
    await expect(
      callTool(otherUserId, 'finance_account_summary', { accountId: checkingId }),
    ).rejects.toThrow('Account not found');
  });
});
