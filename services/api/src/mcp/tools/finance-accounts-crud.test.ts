import { db, pool, sql } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { callTool, type McpToolResult } from '../tool-registry';
import './finance';

const userId = 'f20000a0-0000-4000-8000-000000000001';
const otherUserId = 'f20000a0-0000-4000-8000-000000000002';

type Content = {
  id?: string | null;
  name?: string;
  currencyCode?: string;
  status?: string;
  created?: boolean;
  accounts?: Array<{ id: string; name: string; lifecycleStatus: string }>;
  received?: number;
  rejected?: unknown[];
};

function content(res: McpToolResult<Content>): Content {
  return res.structuredContent ?? {};
}

beforeAll(async () => {
  for (const id of [userId, otherUserId]) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, `Account Create User ${id}`, `${id}@test.hominem.dev`, true],
    );
    // Cascades to this user's transactions and tag assignments.
    await db.deleteFrom('app.financeAccounts').where('userId', '=', id).execute();
  }
});

describe('finance_account_create', () => {
  it('creates an account and reports created: true', async () => {
    const result = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Wise GBP',
        currencyCode: 'GBP',
        institution: 'Wise',
        accountNumber: '0895',
      }),
    );
    expect(result.created).toBe(true);
    expect(result.id).toBeTruthy();
    expect(result).toMatchObject({ name: 'Wise GBP', currencyCode: 'GBP', status: 'open' });
  });

  it('returns the existing account on a case-insensitive re-create', async () => {
    const first = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Starling V1',
        currencyCode: 'GBP',
      }),
    );
    const second = content(
      await callTool(userId, 'finance_account_create', {
        name: 'starling v1',
        currencyCode: 'GBP',
      }),
    );
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);

    const rows = await db
      .selectFrom('app.financeAccounts')
      .select('id')
      .where('userId', '=', userId)
      .where(sql<boolean>`lower(name) = 'starling v1'`)
      .execute();
    expect(rows).toHaveLength(1);
  });

  it('creates a closed account visible only with includeClosed', async () => {
    const created = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Unattributed - Copilot legacy',
        currencyCode: 'USD',
        status: 'closed',
      }),
    );
    expect(created).toMatchObject({ status: 'closed', created: true });

    const openOnly = content(await callTool(userId, 'finance_accounts', {}));
    expect(openOnly.accounts?.some((account) => account.id === created.id)).toBe(false);

    const withClosed = content(await callTool(userId, 'finance_accounts', { includeClosed: true }));
    expect(withClosed.accounts?.some((account) => account.id === created.id)).toBe(true);
  });

  it('dryRun reports the outcome without writing', async () => {
    const wouldCreate = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Apple Savings',
        currencyCode: 'USD',
        dryRun: true,
      }),
    );
    expect(wouldCreate).toMatchObject({ created: true, id: null });

    const rows = await db
      .selectFrom('app.financeAccounts')
      .select('id')
      .where('userId', '=', userId)
      .where(sql<boolean>`lower(name) = 'apple savings'`)
      .execute();
    expect(rows).toHaveLength(0);

    const existing = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Wise GBP',
        currencyCode: 'GBP',
        dryRun: true,
      }),
    );
    expect(existing.created).toBe(false);
    expect(existing.id).toBeTruthy();
  });

  it('scopes the case-insensitive match to the caller', async () => {
    const mine = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Shared Name',
        currencyCode: 'USD',
      }),
    );
    const theirs = content(
      await callTool(otherUserId, 'finance_account_create', {
        name: 'shared name',
        currencyCode: 'USD',
      }),
    );
    expect(theirs.created).toBe(true);
    expect(theirs.id).not.toBe(mine.id);
  });

  it('lets the sheet import resolve an account created here', async () => {
    const result = await callTool(userId, 'finance_transactions_import', {
      mode: 'append',
      transactions: [
        {
          postedOn: '2026-10-10',
          account: 'Wise GBP',
          description: 'Wise Row',
          amountCents: -100,
          currencyCode: 'GBP',
        },
      ],
    });
    expect(content(result)).toMatchObject({ received: 1, created: 1, rejected: [] });
  });

  it('rejects a non-ISO currency code with a named reason', async () => {
    await expect(
      callTool(userId, 'finance_account_create', { name: 'Bad Currency', currencyCode: 'POUNDS' }),
    ).rejects.toThrow(/invalid_currency/);
  });

  it('rejects a blank name with a named reason', async () => {
    await expect(
      callTool(userId, 'finance_account_create', { name: '   ', currencyCode: 'USD' }),
    ).rejects.toThrow(/invalid_name/);
  });
});
