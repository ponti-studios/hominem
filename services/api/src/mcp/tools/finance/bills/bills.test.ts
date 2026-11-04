import { db, pool } from '@hominem/db/core';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { computeNextDueDate } from '../../../../application/finance-bills.service';
import { callTool, type McpToolResult } from '../../../tool-registry';
import '../register';

const userId = 'f2650000-0000-4000-8000-000000000001';
const otherUserId = 'f2650000-0000-4000-8000-000000000002';

const accountId = 'f2650002-0000-4000-8000-000000000001';
const otherAccountId = 'f2650002-0000-4000-8000-000000000002';

type TestBill = {
  id: string;
  name: string;
  status: string;
  type: string;
  currencyCode: string;
  isDismissed: boolean;
  merchantMatch: string[];
  nextDueDate: string | null;
  lastPaid: {
    transactionId: string;
    postedOn: string;
    amount: number;
    currencyCode: string;
  } | null;
  payg: {
    latestBalanceCents: number;
    dailyBurnCents: number | null;
    daysRemaining: number | null;
    estimatedRunOutDate: string | null;
    isStale: boolean;
    isLow: boolean;
  } | null;
  recentEntries?: Array<{ id: string; balanceCents: number; meterReadingKwh: number | null }>;
};

type BillContent = {
  bill?: TestBill | null;
  bills?: TestBill[];
  count?: number;
  removed?: boolean;
  dryRun?: boolean;
  preview?: Array<{ id: string; name: string; balanceEntryCount: number }>;
  entry?: { id: string; balanceCents: number } | null;
};

function content(result: McpToolResult<BillContent>): BillContent {
  return result.structuredContent ?? {};
}

let transactionCounter = 0;

async function insertTransaction(input: {
  merchantName: string | null;
  description?: string | null;
  postedOn: string;
  amount?: number;
  excluded?: boolean;
  pending?: boolean;
}): Promise<string> {
  transactionCounter += 1;
  const id = `f2650003-0000-4000-8000-${String(transactionCounter).padStart(12, '0')}`;
  await db
    .insertInto('app.financeTransactions')
    .values({
      id,
      userId,
      accountId,
      postedOn: input.postedOn,
      description: input.description ?? `bill test ${transactionCounter}`,
      merchantName: input.merchantName,
      amount: input.amount ?? -52.3,
      currencyCode: 'GBP',
      transactionType: 'debit',
      pending: input.pending ?? false,
      excluded: input.excluded ?? false,
      providerPayload: {},
      externalId: `bill-test-${transactionCounter}`,
    })
    .execute();
  return id;
}

async function createBill(input: Record<string, unknown> = {}, asUserId = userId) {
  return content(
    await callTool(asUserId, 'finance_bill_create', {
      name: 'Octopus Energy',
      kind: 'electricity',
      paymentMethod: 'direct_debit',
      amountModel: 'variable',
      currencyCode: 'GBP',
      cadence: 'monthly',
      dueDay: 15,
      merchantMatch: ['octopus energy'],
      ...input,
    }),
  );
}

async function clearUserData(id: string) {
  await db.deleteFrom('app.financeBillBalanceEntries').where('userId', '=', id).execute();
  await db.deleteFrom('app.financeBills').where('userId', '=', id).execute();
  await db.deleteFrom('app.financeTransactions').where('userId', '=', id).execute();
}

beforeAll(async () => {
  for (const [id, name] of [
    [userId, 'Bill Test User'],
    [otherUserId, 'Bill Other User'],
  ] as const) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, name, `${id}@test.hominem.dev`, true],
    );
  }
  await db
    .insertInto('app.financeAccounts')
    .values([
      {
        id: accountId,
        userId,
        name: 'Bill Test Account',
        accountType: 'checking',
        currencyCode: 'GBP',
        lifecycleStatus: 'open',
        metadata: {},
      },
      {
        id: otherAccountId,
        userId: otherUserId,
        name: 'Bill Other Account',
        accountType: 'checking',
        currencyCode: 'GBP',
        lifecycleStatus: 'open',
        metadata: {},
      },
    ])
    .onConflict((conflict) => conflict.column('id').doNothing())
    .execute();
});

beforeEach(async () => {
  await clearUserData(userId);
  await clearUserData(otherUserId);
  transactionCounter = 0;
});

describe('computeNextDueDate', () => {
  it('computes monthly dates with month-end clamping and never stores them', () => {
    expect(
      computeNextDueDate(
        { cadence: 'monthly', dueDay: 20, dueDate: null, anchorDate: null },
        new Date('2026-01-15T00:00:00.000Z'),
      ),
    ).toBe('2026-01-20');
    expect(
      computeNextDueDate(
        { cadence: 'monthly', dueDay: 20, dueDate: null, anchorDate: null },
        new Date('2026-01-25T00:00:00.000Z'),
      ),
    ).toBe('2026-02-20');
    expect(
      computeNextDueDate(
        { cadence: 'monthly', dueDay: 31, dueDate: null, anchorDate: null },
        new Date('2026-02-01T00:00:00.000Z'),
      ),
    ).toBe('2026-02-28');
    expect(
      computeNextDueDate(
        { cadence: 'monthly', dueDay: 31, dueDate: null, anchorDate: null },
        new Date('2026-02-28T12:00:00.000Z'),
      ),
    ).toBe('2026-02-28');
  });

  it('returns one-off due dates and null without a recurrence', () => {
    expect(
      computeNextDueDate(
        { cadence: 'one_off', dueDay: null, dueDate: '2026-03-10', anchorDate: null },
        new Date('2026-01-15T00:00:00.000Z'),
      ),
    ).toBe('2026-03-10');
    expect(
      computeNextDueDate(
        { cadence: null, dueDay: null, dueDate: null, anchorDate: null },
        new Date('2026-01-15T00:00:00.000Z'),
      ),
    ).toBeNull();
  });

  it('steps weekly, quarterly and annual cadences from the anchor', () => {
    expect(
      computeNextDueDate(
        { cadence: 'weekly', dueDay: 3, dueDate: null, anchorDate: '2026-01-05' },
        new Date('2026-01-15T00:00:00.000Z'),
      ),
    ).toBe('2026-01-19');
    expect(
      computeNextDueDate(
        { cadence: 'quarterly', dueDay: 10, dueDate: null, anchorDate: '2026-01-10' },
        new Date('2026-03-20T00:00:00.000Z'),
      ),
    ).toBe('2026-04-10');
    expect(
      computeNextDueDate(
        { cadence: 'annual', dueDay: 1, dueDate: null, anchorDate: '2025-06-01' },
        new Date('2026-01-15T00:00:00.000Z'),
      ),
    ).toBe('2026-06-01');
  });
});

describe('finance_bill_create', () => {
  it('creates a bill with computed next-due state', async () => {
    const created = await createBill();
    expect(created.bill?.name).toBe('Octopus Energy');
    expect(created.bill?.currencyCode).toBe('GBP');
    expect(created.bill?.type).toBe('confirmed');
    expect(created.bill?.nextDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(created.bill?.lastPaid).toBeNull();
    expect(created.bill?.payg).toBeNull();

    const listed = content(await callTool(userId, 'finance_bill_list', {}));
    expect(listed.count).toBe(1);
    expect(listed.bills?.[0]?.id).toBe(created.bill?.id);
  });

  it('rejects schedules the database constraint would refuse', async () => {
    await expect(createBill({ cadence: 'monthly', dueDay: undefined })).rejects.toThrow();
    await expect(
      createBill({
        amountModel: 'top_up',
        expectedAmountCents: 2000,
        cadence: 'monthly',
        dueDay: 5,
      }),
    ).rejects.toThrow(/top-up/i);
    await expect(
      createBill({ amountModel: 'variable', expectedAmountCents: 1000 }),
    ).rejects.toThrow(/variable/i);
    await expect(
      createBill({ cadence: 'one_off', dueDay: undefined, dueDate: undefined }),
    ).rejects.toThrow(/one-off/i);
    await expect(
      createBill({
        cadence: 'weekly',
        dueDay: 2,
        anchorDate: undefined,
        amountModel: 'fixed',
        expectedAmountCents: 100,
      }),
    ).rejects.toThrow(/anchor/i);
  });

  it('rejects an account that is not the caller’s', async () => {
    await expect(createBill({ accountId: otherAccountId })).rejects.toThrow();
  });
});

describe('finance_bill_get', () => {
  it('returns the bill with its log and null for unknown or foreign ids', async () => {
    const created = await createBill({ amountModel: 'fixed', expectedAmountCents: 1000 });
    const fetched = content(
      await callTool(userId, 'finance_bill_get', { billId: created.bill?.id }),
    );
    expect(fetched.bill?.id).toBe(created.bill?.id);
    expect(fetched.bill?.recentEntries).toEqual([]);
    expect(
      content(
        await callTool(userId, 'finance_bill_get', {
          billId: 'f2650009-0000-4000-8000-000000000009',
        }),
      ).bill,
    ).toBeNull();
    expect(
      content(await callTool(otherUserId, 'finance_bill_get', { billId: created.bill?.id })).bill,
    ).toBeNull();
  });
});

describe('finance_bill_update', () => {
  it('applies partial updates without injecting defaults', async () => {
    const created = await createBill({
      status: 'paused',
      merchantMatch: ['octopus energy', 'octopus'],
    });
    const updated = content(
      await callTool(userId, 'finance_bill_update', {
        billId: created.bill?.id,
        name: 'Octopus Energy Ltd',
      }),
    );
    expect(updated.bill?.name).toBe('Octopus Energy Ltd');
    expect(updated.bill?.status).toBe('paused');
    expect(updated.bill?.merchantMatch).toEqual(['octopus energy', 'octopus']);
  });

  it('rejects an empty patch', async () => {
    const created = await createBill();
    await expect(
      callTool(userId, 'finance_bill_update', { billId: created.bill?.id }),
    ).rejects.toThrow();
  });

  it('enforces the suggested/confirmed/cancelled lifecycle', async () => {
    const created = await createBill({ type: 'suggested', isDismissed: true });
    const confirmed = content(
      await callTool(userId, 'finance_bill_update', {
        billId: created.bill?.id,
        type: 'confirmed',
      }),
    );
    expect(confirmed.bill?.type).toBe('confirmed');
    expect(confirmed.bill?.isDismissed).toBe(false);
    await expect(
      callTool(userId, 'finance_bill_update', {
        billId: created.bill?.id,
        type: 'suggested',
      }),
    ).rejects.toThrow();
    await callTool(userId, 'finance_bill_update', {
      billId: created.bill?.id,
      type: 'cancelled',
    });
    await expect(
      callTool(userId, 'finance_bill_update', {
        billId: created.bill?.id,
        type: 'confirmed',
      }),
    ).rejects.toThrow();
    await expect(
      callTool(otherUserId, 'finance_bill_update', {
        billId: created.bill?.id,
        name: 'Hijacked',
      }),
    ).rejects.toThrow();
  });
});

describe('finance_bill_delete', () => {
  it('previews with a dry run, then removes the bill and its log', async () => {
    const created = await createBill({ amountModel: 'fixed', expectedAmountCents: 1000 });
    const topup = await createBill({
      name: 'PAYG meter',
      amountModel: 'top_up',
      expectedAmountCents: 2000,
      paymentMethod: 'pay_as_you_go',
      cadence: undefined,
      dueDay: undefined,
    });
    await callTool(userId, 'finance_bill_log_balance', {
      billId: topup.bill?.id,
      checkedAt: new Date().toISOString(),
      balanceCents: 1000,
      supplyStatus: 'connected',
      source: 'user_report',
    });

    const preview = content(
      await callTool(userId, 'finance_bill_delete', { billId: topup.bill?.id, dryRun: true }),
    );
    expect(preview.removed).toBe(false);
    expect(preview.dryRun).toBe(true);
    expect(preview.preview).toEqual([
      { id: topup.bill?.id, name: 'PAYG meter', balanceEntryCount: 1 },
    ]);
    expect(
      content(await callTool(userId, 'finance_bill_get', { billId: topup.bill?.id })).bill,
    ).not.toBeNull();

    const deleted = content(
      await callTool(userId, 'finance_bill_delete', { billId: topup.bill?.id }),
    );
    expect(deleted.removed).toBe(true);
    expect(
      content(await callTool(userId, 'finance_bill_get', { billId: topup.bill?.id })).bill,
    ).toBeNull();

    await callTool(userId, 'finance_bill_delete', { billId: created.bill?.id });
    expect(content(await callTool(userId, 'finance_bill_list', {})).count).toBe(0);
  });

  it('throws for unknown or foreign bills', async () => {
    const created = await createBill();
    await expect(
      callTool(userId, 'finance_bill_delete', {
        billId: 'f2650009-0000-4000-8000-000000000009',
      }),
    ).rejects.toThrow();
    await expect(
      callTool(otherUserId, 'finance_bill_delete', { billId: created.bill?.id }),
    ).rejects.toThrow();
  });
});

describe('lastPaid claims', () => {
  it('matches case-insensitively and awards each transaction to the earliest bill', async () => {
    const first = await createBill({ merchantMatch: ['octopus energy'] });
    await createBill({ name: 'Later duplicate', merchantMatch: ['OCTOPUS'] });
    const matchId = await insertTransaction({
      merchantName: 'OCTOPUS ENERGY LTD',
      postedOn: '2026-10-20',
    });
    await insertTransaction({
      merchantName: 'Octopus Energy',
      postedOn: '2026-10-21',
      excluded: true,
    });
    await insertTransaction({
      merchantName: 'Octopus Energy',
      postedOn: '2026-10-22',
      pending: true,
    });
    await insertTransaction({ merchantName: 'Unrelated Grocer', postedOn: '2026-10-23' });

    const fetched = content(await callTool(userId, 'finance_bill_get', { billId: first.bill?.id }));
    expect(fetched.bill?.lastPaid).toMatchObject({
      transactionId: matchId,
      postedOn: '2026-10-20',
      currencyCode: 'GBP',
      amount: -52.3,
    });

    const listed = content(await callTool(userId, 'finance_bill_list', {}));
    expect(listed.bills?.find((bill) => bill.name === 'Later duplicate')?.lastPaid).toBeNull();
  });

  it('matches on the description when the merchant name is empty', async () => {
    const created = await createBill({ merchantMatch: ['bulb'] });
    const matchId = await insertTransaction({
      merchantName: null,
      description: 'BULB ENERGY monthly',
      postedOn: '2026-10-20',
    });
    const fetched = content(
      await callTool(userId, 'finance_bill_get', { billId: created.bill?.id }),
    );
    expect(fetched.bill?.lastPaid?.transactionId).toBe(matchId);
  });
});

describe('finance_bill_log_balance', () => {
  it('derives burn, run-out and staleness on top-up bills', async () => {
    const created = await createBill({
      name: 'PAYG meter',
      amountModel: 'top_up',
      expectedAmountCents: 2000,
      paymentMethod: 'pay_as_you_go',
      cadence: undefined,
      dueDay: undefined,
      staleAfterHours: 48,
      paygWarnDays: 7,
    });
    const first = content(
      await callTool(userId, 'finance_bill_log_balance', {
        billId: created.bill?.id,
        checkedAt: '2026-10-01T10:00:00.000Z',
        balanceCents: 5000,
        supplyStatus: 'connected',
        source: 'user_report',
      }),
    );
    expect(first.entry?.balanceCents).toBe(5000);
    expect(first.bill?.payg?.dailyBurnCents).toBeNull();
    expect(first.bill?.payg?.isStale).toBe(true);
    expect(first.bill?.recentEntries).toHaveLength(1);

    const second = content(
      await callTool(userId, 'finance_bill_log_balance', {
        billId: created.bill?.id,
        checkedAt: '2026-10-06T10:00:00.000Z',
        balanceCents: -250,
        meterReadingKwh: 2436.14,
        supplyStatus: 'disconnected',
        source: 'meter_photo',
        note: 'ran out',
      }),
    );
    expect(second.bill?.payg?.latestBalanceCents).toBe(-250);
    expect(second.bill?.payg?.dailyBurnCents).toBeCloseTo(1050, 5);
    expect(second.bill?.payg?.daysRemaining).toBe(0);
    expect(second.bill?.payg?.isLow).toBe(true);
    expect(second.bill?.recentEntries?.map((entry) => entry.id)).toEqual([
      second.entry?.id,
      first.entry?.id,
    ]);
  });

  it('rejects balance entries on bills that are not top-up, and isolates by user', async () => {
    const created = await createBill();
    const input = {
      billId: created.bill?.id,
      checkedAt: new Date().toISOString(),
      balanceCents: 100,
      supplyStatus: 'connected',
      source: 'agent_portal',
    } as const;
    await expect(callTool(userId, 'finance_bill_log_balance', input)).rejects.toThrow();
    const foreign = content(await callTool(otherUserId, 'finance_bill_log_balance', input));
    expect(foreign.entry).toBeNull();
    expect(foreign.bill).toBeNull();
  });
});
