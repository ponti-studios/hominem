import {
  removeUsers,
  resetUsers,
  seedAccounts,
  seedTransactions,
} from '@hominem/finance-services/test/factory';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { structuredContent } from '../../testkit/fixtures/mcp-content';
import { callTool } from '../tool-registry';
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

const content = structuredContent<SummaryContent>;

const tx = (
  n: number,
  accountId: string,
  postedOn: string,
  amount: number,
  options: { currencyCode?: string; excluded?: boolean } = {},
) => ({
  id: `f20000b2-0000-4000-8000-00000000000${n}`,
  accountId,
  postedOn,
  amount,
  description: 'Row',
  transactionType: 'debit',
  externalId: `summary-${n}`,
  ...options,
});

beforeAll(async () => {
  await resetUsers(userId, otherUserId);
  await seedAccounts(userId, [
    { id: checkingId, name: 'Summary Checking' },
    { id: savingsId, name: 'Summary Savings' },
    { id: closedId, name: 'Summary Closed', lifecycleStatus: 'closed', includeInNetWorth: false },
  ]);
  await seedTransactions(userId, [
    tx(1, checkingId, '2026-01-05', -10),
    tx(2, checkingId, '2026-02-10', -25),
    tx(3, checkingId, '2026-03-01', -5, { excluded: true }),
    tx(4, checkingId, '2026-03-02', -7, { currencyCode: 'GBP' }),
    tx(5, savingsId, '2026-04-01', 50),
  ]);
});

afterAll(() => removeUsers(userId, otherUserId));

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
