import { db, pool } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { callTool, type McpToolResult } from '../tool-registry';
import './finance';

const ownerId = 'f2000200-0000-4000-8000-000000000001';
const otherUserId = 'f2000200-0000-4000-8000-000000000002';
const netWorthOwnerId = 'f2000200-0000-4000-8000-000000000003';

type AccountRow = {
  id?: string;
  accountId?: string;
  name?: string;
  includeInNetWorth?: boolean;
  balance?: number;
};

type Content = {
  id?: string | null;
  name?: string | null;
  status?: string | null;
  includeInNetWorth?: boolean | null;
  created?: boolean;
  updated?: boolean;
  changes?: Record<string, [string | null, string | null]>;
  reason?: string | null;
  accounts?: AccountRow[];
  totals?: Array<{ currencyCode: string; total: number; accountCount: number }>;
};

function content(res: McpToolResult<Content>): Content {
  return res.structuredContent ?? {};
}

async function createAccount(
  owner: string,
  name: string,
  includeInNetWorth?: boolean,
): Promise<Content> {
  return content(
    await callTool(owner, 'finance_account_create', {
      name,
      currencyCode: 'USD',
      ...(includeInNetWorth !== undefined ? { includeInNetWorth } : {}),
    }),
  );
}

async function storedFlag(id: string): Promise<boolean | undefined> {
  const row = await db
    .selectFrom('app.financeAccounts')
    .select('includeInNetWorth')
    .where('id', '=', id)
    .executeTakeFirst();
  return row?.includeInNetWorth;
}

async function listedFlag(owner: string, id: string): Promise<boolean | undefined> {
  const listed = content(await callTool(owner, 'finance_accounts', { includeClosed: true }));
  return listed.accounts?.find((account) => account.id === id)?.includeInNetWorth;
}

beforeAll(async () => {
  for (const id of [ownerId, otherUserId, netWorthOwnerId]) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, `Net Worth Flag User ${id}`, `${id}@test.hominem.dev`, true],
    );
    // Cascades to this user's transactions and tag assignments.
    await db.deleteFrom('app.financeAccounts').where('userId', '=', id).execute();
  }
});

describe('finance_account_create includeInNetWorth', () => {
  it('defaults to true when omitted and returns the stored flag', async () => {
    const created = await createAccount(ownerId, 'Defaulted Into Net Worth');
    expect(created).toMatchObject({ created: true, includeInNetWorth: true });
    expect(await storedFlag(created.id ?? '')).toBe(true);
    expect(await listedFlag(ownerId, created.id ?? '')).toBe(true);
  });

  it('stores an explicit true', async () => {
    const created = await createAccount(ownerId, 'Explicitly Counted', true);
    expect(created).toMatchObject({ created: true, includeInNetWorth: true });
    expect(await storedFlag(created.id ?? '')).toBe(true);
    expect(await listedFlag(ownerId, created.id ?? '')).toBe(true);
  });

  it('stores an explicit false and reads it back', async () => {
    const created = await createAccount(ownerId, 'Explicitly Excluded', false);
    expect(created).toMatchObject({ created: true, includeInNetWorth: false });
    expect(await storedFlag(created.id ?? '')).toBe(false);
    expect(await listedFlag(ownerId, created.id ?? '')).toBe(false);
  });

  it('keeps the stored flag when the account already exists', async () => {
    const first = await createAccount(ownerId, 'Existing Excluded Account', false);
    const second = await createAccount(ownerId, 'existing excluded account', true);
    expect(second).toMatchObject({ created: false, id: first.id, includeInNetWorth: false });
    expect(await storedFlag(first.id ?? '')).toBe(false);
  });
});

describe('finance_account_update includeInNetWorth', () => {
  it('keeps the stored value through a rename that omits the flag', async () => {
    const created = await createAccount(ownerId, 'Rename Keeps Exclusion', false);
    const renamed = content(
      await callTool(ownerId, 'finance_account_update', {
        accountId: created.id ?? '',
        name: 'Renamed Still Excluded',
      }),
    );
    expect(renamed).toMatchObject({ updated: true, includeInNetWorth: false });
    expect(renamed.changes).toEqual({ name: ['Rename Keeps Exclusion', 'Renamed Still Excluded'] });
    expect(await storedFlag(created.id ?? '')).toBe(false);
    expect(await listedFlag(ownerId, created.id ?? '')).toBe(false);
  });

  it('sets and clears the flag without touching status', async () => {
    const created = await createAccount(ownerId, 'Toggled Flag Account', true);

    const excluded = content(
      await callTool(ownerId, 'finance_account_update', {
        accountId: created.id ?? '',
        includeInNetWorth: false,
      }),
    );
    expect(excluded).toMatchObject({
      updated: true,
      includeInNetWorth: false,
      status: 'open',
    });
    expect(excluded.changes).toEqual({ includeInNetWorth: ['true', 'false'] });
    expect(await storedFlag(created.id ?? '')).toBe(false);
    expect(await listedFlag(ownerId, created.id ?? '')).toBe(false);

    const included = content(
      await callTool(ownerId, 'finance_account_update', {
        accountId: created.id ?? '',
        includeInNetWorth: true,
      }),
    );
    expect(included).toMatchObject({ updated: true, includeInNetWorth: true, status: 'open' });
    expect(included.changes).toEqual({ includeInNetWorth: ['false', 'true'] });
    expect(await storedFlag(created.id ?? '')).toBe(true);
    expect(await listedFlag(ownerId, created.id ?? '')).toBe(true);
  });

  it('leaves the flag alone when only the status changes', async () => {
    const created = await createAccount(ownerId, 'Status Only Account', false);
    const closed = content(
      await callTool(ownerId, 'finance_account_update', {
        accountId: created.id ?? '',
        status: 'closed',
      }),
    );
    expect(closed).toMatchObject({ updated: true, includeInNetWorth: false, status: 'closed' });
    expect(closed.changes).toEqual({ status: ['open', 'closed'] });
    expect(await storedFlag(created.id ?? '')).toBe(false);
  });

  it('treats another user’s account as not found', async () => {
    const created = await createAccount(ownerId, 'Owner Scoped Flag Account', true);
    const id = created.id ?? '';

    const hijack = content(
      await callTool(otherUserId, 'finance_account_update', {
        accountId: id,
        includeInNetWorth: false,
      }),
    );
    expect(hijack).toMatchObject({ reason: 'unknown_account', includeInNetWorth: null });
    expect(hijack.changes).toEqual({});
    expect(await storedFlag(id)).toBe(true);

    const theirList = content(await callTool(otherUserId, 'finance_accounts', {}));
    expect(theirList.accounts?.some((account) => account.id === id)).toBe(false);

    await expect(
      callTool(otherUserId, 'finance_account_summary', { accountId: id }),
    ).rejects.toThrow('Account not found');
  });

  it('reports an unknown account id without writing', async () => {
    const result = content(
      await callTool(ownerId, 'finance_account_update', {
        accountId: 'f2000209-0000-4000-8000-000000000009',
        includeInNetWorth: false,
      }),
    );
    expect(result).toMatchObject({ reason: 'unknown_account', updated: false });
  });
});

describe('finance_net_worth honours includeInNetWorth', () => {
  it('includes an account by exactly its balance and excludes it when the flag is off', async () => {
    const created = await createAccount(netWorthOwnerId, 'Net Worth Probe Account', true);
    const accountId = created.id ?? '';
    await db
      .insertInto('app.financeTransactions')
      .values({
        id: 'f2000201-0000-4000-8000-000000000001',
        userId: netWorthOwnerId,
        accountId,
        postedOn: '2026-09-01',
        description: 'Net worth probe balance',
        amount: 432.1,
        currencyCode: 'USD',
        transactionType: 'credit',
        pending: false,
        excluded: false,
        externalId: 'net-worth-flag-probe',
        providerPayload: {},
      })
      .execute();

    const included = content(await callTool(netWorthOwnerId, 'finance_net_worth', {}));
    expect(included.totals).toEqual([{ currencyCode: 'USD', total: 432.1, accountCount: 1 }]);
    const probeBalance = included.accounts?.find(
      (account) => account.accountId === accountId,
    )?.balance;
    expect(probeBalance).toBe(432.1);

    const excluded = content(
      await callTool(netWorthOwnerId, 'finance_account_update', {
        accountId,
        includeInNetWorth: false,
      }),
    );
    expect(excluded).toMatchObject({ includeInNetWorth: false });

    const afterExclusion = content(await callTool(netWorthOwnerId, 'finance_net_worth', {}));
    expect(afterExclusion.accounts?.some((account) => account.accountId === accountId)).toBe(false);
    expect(afterExclusion.totals).toEqual([]);

    const includedTotal = included.totals?.[0]?.total ?? 0;
    const excludedTotal = afterExclusion.totals?.[0]?.total ?? 0;
    expect(includedTotal - excludedTotal).toBe(probeBalance);

    await callTool(netWorthOwnerId, 'finance_account_update', {
      accountId,
      includeInNetWorth: true,
    });
    const restored = content(await callTool(netWorthOwnerId, 'finance_net_worth', {}));
    expect(restored.totals).toEqual([{ currencyCode: 'USD', total: 432.1, accountCount: 1 }]);
  });
});
