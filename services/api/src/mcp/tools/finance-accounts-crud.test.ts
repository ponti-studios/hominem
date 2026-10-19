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
  allowedCurrencies?: string[];
  status?: string;
  created?: boolean;
  accounts?: Array<{ id: string; name: string; lifecycleStatus: string }>;
  received?: number;
  rejected?: unknown[];
  deleted?: { id: string; name: string };
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
        name: 'Example GBP Account',
        currencyCode: 'GBP',
        institution: 'Example Bank',
        accountNumber: '0895',
      }),
    );
    expect(result.created).toBe(true);
    expect(result.id).toBeTruthy();
    expect(result).toMatchObject({
      name: 'Example GBP Account',
      currencyCode: 'GBP',
      status: 'open',
    });
  });

  it('persists and returns account-specific allowed currencies', async () => {
    const created = content(
      await callTool(userId, 'finance_account_create', {
        name: 'USD and GBP Account',
        currencyCode: 'USD',
        allowedCurrencies: ['GBP'],
      }),
    );
    expect(created.allowedCurrencies).toEqual(['USD', 'GBP']);

    const listed = content(await callTool(userId, 'finance_accounts', {}));
    expect(listed.accounts?.find((item) => item.id === created.id)).toMatchObject({
      currencyCode: 'USD',
      allowedCurrencies: ['USD', 'GBP'],
    });
  });

  it('returns the existing account on a case-insensitive re-create', async () => {
    const first = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Example Legacy Account',
        currencyCode: 'GBP',
      }),
    );
    const second = content(
      await callTool(userId, 'finance_account_create', {
        name: 'example legacy account',
        currencyCode: 'GBP',
      }),
    );
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);

    const rows = await db
      .selectFrom('app.financeAccounts')
      .select('id')
      .where('userId', '=', userId)
      .where(sql<boolean>`lower(name) = 'example legacy account'`)
      .execute();
    expect(rows).toHaveLength(1);
  });

  it('creates a closed account visible only with includeClosed', async () => {
    const created = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Example Closed Account',
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
        name: 'Example Savings',
        currencyCode: 'USD',
        dryRun: true,
      }),
    );
    expect(wouldCreate).toMatchObject({ created: true, id: null });

    const rows = await db
      .selectFrom('app.financeAccounts')
      .select('id')
      .where('userId', '=', userId)
      .where(sql<boolean>`lower(name) = 'example savings'`)
      .execute();
    expect(rows).toHaveLength(0);

    const existing = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Example GBP Account',
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

  it('records the requested accountType', async () => {
    const created = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Type Savings',
        currencyCode: 'USD',
        accountType: 'savings',
      }),
    );
    const row = await db
      .selectFrom('app.financeAccounts')
      .select('accountType')
      .where('id', '=', created.id ?? '')
      .executeTakeFirstOrThrow();
    expect(row.accountType).toBe('savings');
  });

  it('identifies a projected account create and does not persist it', async () => {
    const projected = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Projected Account',
        currencyCode: 'USD',
        dryRun: true,
      }),
    );
    expect(projected).toMatchObject({ id: null, created: true, dryRun: true });
    await expect(
      db
        .selectFrom('app.financeAccounts')
        .select('id')
        .where('userId', '=', userId)
        .where('name', '=', 'Projected Account')
        .executeTakeFirst(),
    ).resolves.toBeUndefined();
  });

  it('lets the sheet import resolve an account created here', async () => {
    const result = await callTool(userId, 'finance_transactions_import', {
      mode: 'append',
      transactions: [
        {
          postedOn: '2026-10-10',
          account: 'Example GBP Account',
          description: 'Example Row',
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

  it('rejects a three-letter code outside ISO 4217 and accepts XXX', async () => {
    await expect(
      callTool(userId, 'finance_account_create', { name: 'Unknown Currency', currencyCode: 'ZZZ' }),
    ).rejects.toThrow(/invalid_currency/);

    const noCurrency = content(
      await callTool(userId, 'finance_account_create', {
        name: 'No Currency Account',
        currencyCode: 'XXX',
      }),
    );
    expect(noCurrency).toMatchObject({ created: true, currencyCode: 'XXX' });
  });

  it('rejects a blank name with a named reason', async () => {
    await expect(
      callTool(userId, 'finance_account_create', { name: '   ', currencyCode: 'USD' }),
    ).rejects.toThrow(/invalid_name/);
  });
});

describe('finance_account_delete', () => {
  it('permanently deletes an empty account and account summary returns not-found', async () => {
    const created = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Empty Account To Delete',
        currencyCode: 'USD',
      }),
    );
    const id = created.id!;

    const deleted = content(
      await callTool(userId, 'finance_account_delete', { accountId: id, iUnderstand: true }),
    );
    expect(deleted.deleted).toEqual({ id, name: 'Empty Account To Delete' });
    expect(content(await callTool(userId, 'finance_accounts', {})).accounts).not.toContainEqual(
      expect.objectContaining({ id }),
    );
    await expect(callTool(userId, 'finance_account_summary', { accountId: id })).rejects.toThrow(
      'Account not found',
    );
    await expect(
      db
        .selectFrom('app.financeAccounts')
        .select('id')
        .where('id', '=', id)
        .where('userId', '=', userId)
        .executeTakeFirst(),
    ).resolves.toBeUndefined();
  });

  it('refuses non-empty accounts with the exact transaction count and preserves the row', async () => {
    const created = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Non-empty Account',
        currencyCode: 'USD',
      }),
    );
    const id = created.id!;
    await callTool(userId, 'finance_transactions_import', {
      transactions: [
        {
          postedOn: '2026-10-18',
          account: 'Non-empty Account',
          description: 'Account deletion guard',
          amountCents: -500,
          currencyCode: 'USD',
          externalId: 'account-delete-guard-row',
        },
      ],
    });

    await expect(
      callTool(userId, 'finance_account_delete', { accountId: id, iUnderstand: true }),
    ).rejects.toThrow('account_not_empty: 1 transaction(s)');
    await expect(
      db
        .selectFrom('app.financeAccounts')
        .select('id')
        .where('id', '=', id)
        .where('userId', '=', userId)
        .executeTakeFirst(),
    ).resolves.toMatchObject({ id });
  });

  it("treats another user's account as not-found", async () => {
    const created = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Private Empty Account',
        currencyCode: 'USD',
      }),
    );
    await expect(
      callTool(otherUserId, 'finance_account_delete', {
        accountId: created.id,
        iUnderstand: true,
      }),
    ).rejects.toThrow('Account not found');
  });
});
