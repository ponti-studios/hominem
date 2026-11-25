import { db, pool, sql } from '@hominem/db/core';
import { FINANCE_TRANSACTION_ENTITY_TYPE } from '@hominem/finance-services';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '../../../../auth/types';
import type { AppContext } from '../../../../rpc/middleware/auth';
import { apiErrorHandler } from '../../../../rpc/middleware/error';
import { financeRoutes } from '../../../../rpc/routes/finance';
import {
  financeWealthBriefOutputSchema,
  financeWealthCloseOutputSchema,
  financeWealthIntegrityOutputSchema,
  financeWealthLookOutputSchema,
} from '../../../../schemas/finance.wealth.schema';
import { callTool, listToolsForScopes } from '../../../tool-registry';
import '../register';

const userId = 'f2970000-0000-4000-8000-000000000001';
const otherUserId = 'f2970000-0000-4000-8000-000000000002';
const checkingId = 'f2970001-0000-4000-8000-000000000001';
const cardId = 'f2970001-0000-4000-8000-000000000002';
const savingsId = 'f2970001-0000-4000-8000-000000000003';
const otherCheckingId = 'f2970001-0000-4000-8000-000000000004';
const foodId = 'f2970002-0000-4000-8000-000000000001';
const incomeId = 'f2970002-0000-4000-8000-000000000002';
const otherFoodId = 'f2970002-0000-4000-8000-000000000003';

let transactionCounter = 0;

async function removeUser(id: string) {
  await pool.query(
    'DELETE FROM app.tag_assignments WHERE tag_id IN (SELECT id FROM app.tags WHERE owner_userid = $1)',
    [id],
  );
  await db.deleteFrom('app.financeBudgets').where('userId', '=', id).execute();
  await db.deleteFrom('app.financeBills').where('userId', '=', id).execute();
  await db.deleteFrom('app.financeRunwayPreferences').where('userId', '=', id).execute();
  await db.deleteFrom('app.userProfiles').where('userId', '=', id).execute();
  await db.deleteFrom('app.tags').where('ownerUserid', '=', id).execute();
  await db.deleteFrom('app.financeTransactions').where('userId', '=', id).execute();
  await db.deleteFrom('app.financeCategories').where('userId', '=', id).execute();
  await db.deleteFrom('app.financeAccounts').where('userId', '=', id).execute();
  await pool.query('DELETE FROM "user" WHERE id = $1', [id]);
}

async function transaction(input: {
  owner?: string;
  accountId: string;
  categoryId?: string;
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  source?: string;
  externalId?: string;
  pending?: boolean;
}) {
  transactionCounter += 1;
  const id = `f2970003-0000-4000-8000-${String(transactionCounter).padStart(12, '0')}`;
  await db
    .insertInto('app.financeTransactions')
    .values({
      id,
      userId: input.owner ?? userId,
      accountId: input.accountId,
      categoryId: input.categoryId ?? null,
      postedOn: input.date,
      description: input.merchant,
      merchantName: input.merchant,
      amount: input.amount,
      currencyCode: input.currency,
      transactionType: input.amount < 0 ? 'debit' : 'credit',
      source: input.source ?? 'manual',
      pending: input.pending ?? false,
      excluded: false,
      providerPayload: {},
      externalId: input.externalId ?? `wealth-fixture-${transactionCounter}`,
    })
    .execute();
  return id;
}

async function tag(name: string, transactionIds: string[]) {
  const slug = name.toLowerCase();
  const row = await db
    .insertInto('app.tags')
    .values({ ownerUserid: userId, name, slug, path: slug })
    .returning('id')
    .executeTakeFirstOrThrow();
  await db
    .insertInto('app.tagAssignments')
    .values(
      transactionIds.map((entityId) => ({
        tagId: row.id,
        entityTable: sql<string>`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`,
        entityId,
      })),
    )
    .execute();
  return row.id;
}

beforeAll(async () => {
  for (const id of [userId, otherUserId]) {
    await removeUser(id);
    await pool.query(
      'INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)',
      [id, 'Synthetic Wealth User', `${id}@test.hominem.dev`, true],
    );
  }
  await db
    .insertInto('app.financeAccounts')
    .values([
      {
        id: checkingId,
        userId,
        name: 'Synthetic Checking',
        accountType: 'checking',
        currencyCode: 'GBP',
        provider: 'starling',
        providerAccountId: 'synthetic-starling',
        includeInNetWorth: true,
        lifecycleStatus: 'open',
        metadata: {},
      },
      {
        id: cardId,
        userId,
        name: 'Synthetic Card',
        accountType: 'credit_card',
        currencyCode: 'USD',
        provider: 'plaid',
        mask: '4242',
        includeInNetWorth: true,
        lifecycleStatus: 'open',
        metadata: {},
      },
      {
        id: savingsId,
        userId,
        name: 'Synthetic Saver',
        accountType: 'savings',
        currencyCode: 'USD',
        includeInNetWorth: true,
        lifecycleStatus: 'open',
        metadata: {},
      },
      {
        id: otherCheckingId,
        userId: otherUserId,
        name: 'Other Checking',
        accountType: 'checking',
        currencyCode: 'GBP',
        includeInNetWorth: true,
        lifecycleStatus: 'open',
        metadata: {},
      },
    ])
    .execute();
  await db
    .insertInto('app.financeCategories')
    .values([
      { id: foodId, userId, name: 'Food' },
      { id: incomeId, userId, name: 'Income' },
      { id: otherFoodId, userId: otherUserId, name: 'Food' },
    ])
    .execute();
  await db
    .insertInto('app.financeRunwayPreferences')
    .values({ userId, currencyCode: 'GBP' })
    .execute();

  await transaction({
    accountId: checkingId,
    date: '2026-11-01',
    merchant: 'Opening balance',
    amount: 1000,
    currency: 'GBP',
    source: 'starling',
  });
  await transaction({
    accountId: checkingId,
    categoryId: incomeId,
    date: '2026-10-25',
    merchant: 'Synthetic Payroll',
    amount: 500,
    currency: 'GBP',
    source: 'starling',
  });
  const groceries = await transaction({
    accountId: checkingId,
    categoryId: foodId,
    date: '2026-10-20',
    merchant: 'Sample Grocer',
    amount: -80,
    currency: 'GBP',
    source: 'starling',
  });
  const coffee = await Promise.all(
    [1, 2].map(() =>
      transaction({
        accountId: checkingId,
        categoryId: foodId,
        date: '2026-11-21',
        merchant: 'Cafe Nova',
        amount: -60,
        currency: 'GBP',
        source: 'starling',
      }),
    ),
  );
  const pendingCoffee = await transaction({
    accountId: checkingId,
    categoryId: foodId,
    date: '2026-11-20',
    merchant: 'Cafe Nova',
    amount: -90,
    currency: 'GBP',
    pending: true,
  });
  await transaction({
    accountId: checkingId,
    categoryId: incomeId,
    date: '2026-11-22',
    merchant: 'Synthetic Payroll',
    amount: 1100,
    currency: 'GBP',
    pending: true,
  });
  await transaction({
    accountId: cardId,
    categoryId: foodId,
    date: '2026-11-01',
    merchant: 'Card Purchase',
    amount: -180,
    currency: 'USD',
  });
  await transaction({
    accountId: cardId,
    categoryId: foodId,
    date: '2026-11-21',
    merchant: 'US Coffee',
    amount: -20,
    currency: 'USD',
  });
  await transaction({
    accountId: savingsId,
    date: '2026-10-01',
    merchant: 'Opening savings',
    amount: 500,
    currency: 'USD',
  });
  await transaction({
    owner: otherUserId,
    accountId: otherCheckingId,
    categoryId: otherFoodId,
    date: '2026-11-21',
    merchant: 'Other Private Merchant',
    amount: -999,
    currency: 'GBP',
  });
  const coffeeId = await tag('Coffee', [...coffee, pendingCoffee]);
  await tag('Groceries', [groceries]);
  await callTool(userId, 'finance_primary_currency_set', { currencyCode: 'GBP' });
  await callTool(userId, 'finance_budget_create', {
    categoryId: foodId,
    amountCents: 40000,
    cadence: 'monthly',
  });
  await callTool(userId, 'finance_budget_create', {
    categoryId: foodId,
    tagId: coffeeId,
    amountCents: 10000,
    cadence: 'monthly',
  });
  await callTool(userId, 'finance_bill_create', {
    name: 'Sample Rent',
    providerName: 'Sample Housing',
    kind: 'rent',
    paymentMethod: 'direct_debit',
    amountModel: 'fixed',
    expectedAmountCents: 3000,
    currencyCode: 'GBP',
    cadence: 'monthly',
    dueDay: 24,
    merchantMatch: ['Sample Rent'],
  });
});

afterAll(async () => {
  await removeUser(userId);
  await removeUser(otherUserId);
});

const date = '2026-11-22';

describe('wealth report tools', () => {
  it('requires finance:read to discover every report', () => {
    const names = [
      'finance_wealth_brief',
      'finance_wealth_look',
      'finance_wealth_close',
      'finance_wealth_integrity',
    ];
    const allowed = listToolsForScopes(['finance:read']).map((tool) => tool.name);
    const denied = listToolsForScopes(['career:read']).map((tool) => tool.name);
    for (const name of names) {
      expect(allowed).toContain(name);
      expect(denied).not.toContain(name);
    }
  });

  it('reports currency-separated movement, budget composition, anomalies and snapshot changes', async () => {
    const first = financeWealthBriefOutputSchema.parse(
      (await callTool(userId, 'finance_wealth_brief', { date, run_id: 7 })).structuredContent,
    );
    expect(first).toMatchObject({ ok: true, date, run_id: 7, silent: false });
    expect(first.sections.money_in_out?.per_currency).toEqual({
      GBP: { in: 0, out: 120, net: -120, count: 2 },
      USD: { in: 0, out: 20, net: -20, count: 1 },
    });
    expect(first.sections.diagnostics.pacing_all?.Food).toMatchObject({
      currency: 'GBP',
      budget: 400,
      month_to_date: 120,
      components: { Coffee: { budget: 100, month_to_date: 120, over_tag_budget: true } },
      mix_note: expect.stringContaining('composition'),
    });
    expect(first.sections.anomalies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'duplicate_charge', merchant: 'Cafe Nova', count: 2 }),
        expect.objectContaining({ type: 'first_seen_merchant', merchant: 'Cafe Nova' }),
      ]),
    );
    expect(first.sections.bills).toMatchObject({
      baseline_created: true,
      active_bills: 1,
      due_soon: [{ bill: 'Sample Rent', date: '2026-11-24', amount: 30, currency: 'GBP' }],
    });
    const snapshot = first.snapshot;
    if (!snapshot) throw new Error('Expected the bill snapshot');
    const prior = {
      bills: snapshot.bills.map((bill) => ({ ...bill, expected_amount: 15 })),
    };
    const next = financeWealthBriefOutputSchema.parse(
      (await callTool(userId, 'finance_wealth_brief', { date, bills_only: true, snapshot: prior }))
        .structuredContent,
    );
    expect(next.sections.money_in_out).toBeUndefined();
    expect(next.sections.bills?.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'bill_amount_change',
          bill: 'Sample Rent',
          previous_amount: 15,
          amount: 30,
        }),
      ]),
    );
    expect(next.snapshot).toEqual(snapshot);
    const retired = snapshot.bills[0];
    if (!retired) throw new Error('Expected the registered bill');
    const changed = financeWealthBriefOutputSchema.parse(
      (
        await callTool(userId, 'finance_wealth_brief', {
          date,
          bills_only: true,
          snapshot: { bills: [{ ...retired, id: 'retired-bill', name: 'Retired Bill' }] },
        })
      ).structuredContent,
    );
    expect(changed.sections.bills?.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'new_bill', bill: 'Sample Rent' }),
        expect.objectContaining({ type: 'bill_inactive', bill: 'Retired Bill' }),
      ]),
    );
  });

  it('reports variable, top-up and inactive bills without inventing their amounts', async () => {
    const rows = await db
      .insertInto('app.financeBills')
      .values([
        {
          userId,
          name: 'Variable Power',
          kind: 'electricity',
          paymentMethod: 'direct_debit',
          amountModel: 'variable',
          currencyCode: 'GBP',
          cadence: 'monthly',
          dueDay: 25,
        },
        {
          userId,
          name: 'Meter Topup',
          kind: 'heating',
          paymentMethod: 'pay_as_you_go',
          amountModel: 'top_up',
          expectedAmountCents: 1000,
          currencyCode: 'GBP',
        },
        {
          userId,
          name: 'Paused Bill',
          kind: 'other',
          paymentMethod: 'manual',
          amountModel: 'fixed',
          expectedAmountCents: 100,
          currencyCode: 'GBP',
          cadence: 'monthly',
          dueDay: 25,
          status: 'paused',
        },
      ])
      .returning('id')
      .execute();
    try {
      const result = financeWealthLookOutputSchema.parse(
        (await callTool(userId, 'finance_wealth_look', { as_of: date })).structuredContent,
      );
      expect(result.sections.diagnostics.bills).toMatchObject({
        variable_due: [{ bill: 'Variable Power', date: '2026-11-25', currency: 'GBP' }],
        topups: [{ bill: 'Meter Topup', payg: null }],
        inactive: ['Paused Bill'],
      });
      expect(result.sections.timeline_gbp.map((entry) => entry.label)).toEqual([
        'Sample Rent — Sample Housing',
      ]);
    } finally {
      await db
        .deleteFrom('app.financeBills')
        .where(
          'id',
          'in',
          rows.map((row) => row.id),
        )
        .execute();
    }
  });

  it('projects registered bills and inferred salary without blending balances or assuming FX', async () => {
    const result = financeWealthLookOutputSchema.parse(
      (
        await callTool(userId, 'finance_wealth_look', {
          as_of: date,
          inputs: {
            balance_floors: { GBP: 1400 },
            credit_limits_usd: { 'Synthetic Card': 1000 },
            salary: {
              query: 'Synthetic Payroll',
              min_amount: 400,
              currency: 'GBP',
              lookback_days: 90,
              label: 'Salary',
            },
          },
          fx: { rate_usd_to_gbp: 0.8, rate_date: '2026-11-21', rate_source: 'fixture' },
        })
      ).structuredContent,
    );
    expect(result).toMatchObject({
      ok: true,
      as_of: date,
      horizon_days: 30,
      horizon: { from: '2026-11-23', to: '2026-12-22' },
    });
    expect(result.sections.timeline_gbp).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: '2026-11-24',
          label: 'Sample Rent — Sample Housing',
          amount: -30,
          currency: 'GBP',
          inferred: false,
        }),
        expect.objectContaining({
          date: '2026-11-25',
          label: 'Salary',
          amount: 500,
          currency: 'GBP',
          inferred: true,
        }),
      ]),
    );
    expect(result.sections.pinch_points?.gbp).toMatchObject({
      starting_balance: 1300,
      floor: 1400,
      min_projected: { date: '2026-11-24', balance: 1270 },
      ending_balance: 1770,
    });
    expect(result.sections.utilisation).toEqual([
      expect.objectContaining({
        card: 'Synthetic Card',
        balance_owed: 200,
        limit: 1000,
        utilisation_pct: 20,
      }),
    ]);
    expect(result.sections.runway?.parameters.monthlyBudgets).toEqual([
      { category: 'Food', amountCents: 40000 },
    ]);
    expect(result.sections.fx_runway).toMatchObject({
      usd_liquid_balance: 500,
      rate_usd_to_gbp: 0.8,
      usd_in_gbp: 400,
      average_monthly_gbp_spend: 26.67,
      spend_window: { from: '2026-08-01', to: '2026-10-31' },
    });

    const withoutInputs = financeWealthLookOutputSchema.parse(
      (await callTool(userId, 'finance_wealth_look', { as_of: date })).structuredContent,
    );
    expect(withoutInputs.sections.fx_runway).toBeUndefined();
    expect(withoutInputs.sections.diagnostics.notes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('no USD-to-GBP rate supplied'),
        expect.stringContaining('inputs absent'),
      ]),
    );
    const unrelated = financeWealthLookOutputSchema.parse(
      (
        await callTool(userId, 'finance_wealth_look', {
          as_of: date,
          inputs: {
            salary: {
              query: 'Synthetic Unrelated',
              min_amount: 400,
              currency: 'GBP',
              lookback_days: 90,
              label: 'Salary',
            },
          },
        })
      ).structuredContent,
    );
    expect(unrelated.sections.timeline_gbp.some((entry) => entry.inferred)).toBe(false);
    expect(unrelated.sections.diagnostics.notes).toEqual(
      expect.arrayContaining([expect.stringContaining('no payroll-sized inflow found')]),
    );
  });

  it('uses the report date rather than later spending for budget breaches', async () => {
    const id = await transaction({
      accountId: checkingId,
      categoryId: foodId,
      date: '2026-11-24',
      merchant: 'Later purchase',
      amount: -500,
      currency: 'GBP',
    });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-25T12:00:00Z'));
    try {
      const result = financeWealthBriefOutputSchema.parse(
        (await callTool(userId, 'finance_wealth_brief', { date })).structuredContent,
      );
      expect(result.sections.diagnostics.pacing_all?.Food).toMatchObject({
        month_to_date: 120,
      });
      expect(result.sections.diagnostics.pacing_all?.Food?.over_budget).toBeUndefined();
      expect(result.sections.budget_pacing?.some((entry) => entry.category === 'Food')).not.toBe(
        true,
      );
    } finally {
      vi.useRealTimers();
      await db.deleteFrom('app.financeTransactions').where('id', '=', id).execute();
    }
  });

  it('closes the requested month with caller-supplied anchors and a visible cache diff', async () => {
    const result = financeWealthCloseOutputSchema.parse(
      (
        await callTool(userId, 'finance_wealth_close', {
          month: '2026-10',
          today: date,
          anchors: {
            anchors: [
              {
                date: '2026-10-31',
                label: 'Synthetic anchor',
                totals: { GBP: 2200 },
                basis: 'fixture',
              },
            ],
            tax_status: ['Synthetic tax note'],
          },
          cache: {
            spending: { categories: [{ categoryName: 'Food', currencyCode: 'GBP', spent: 70 }] },
          },
        })
      ).structuredContent,
    );
    expect(result.md).toContain('# Monthly close — 2026-10');
    expect(result.md).toContain('| GBP | £500.00 | £80.00 | £420.00 | 84.0% |');
    expect(result.md).toContain('Food (GBP): hygiene £70.00 → live £80.00');
    expect(result.md).toContain('Synthetic anchor: GBP £2,200.00. Basis: fixture');
    expect(result.md).toContain('Synthetic tax note');
    expect(result.md).toContain('$300.00 (2 accounts), £1,300.00 (1 account).');
    expect(result.message).toMatch(/month 2026-10: \d+ hominem calls/);
    expect(result.md).not.toContain('Other Private Merchant');

    const noInputs = financeWealthCloseOutputSchema.parse(
      (await callTool(userId, 'finance_wealth_close', { month: '2026-10', today: date }))
        .structuredContent,
    );
    expect(noInputs.md).toContain('not supplied — no cache diff');
    expect(noInputs.md).toContain('No monthly close anchors supplied');
  });

  it('states an empty month instead of printing blank figures', async () => {
    const empty = financeWealthCloseOutputSchema.parse(
      (await callTool(userId, 'finance_wealth_close', { month: '2020-01', today: date }))
        .structuredContent,
    );
    expect(empty.md).toContain('| — | none posted | none posted | — | — |');
    expect(empty.md).toContain('net cash flow (income − spend, plumbing excluded): none posted.');
    expect(empty.md).not.toMatch(/: \.$/m);
  });

  it('does not flag a missing Plaid watermark when no Plaid data is supplied', async () => {
    const result = financeWealthIntegrityOutputSchema.parse(
      (
        await callTool(userId, 'finance_wealth_integrity', {
          date,
          sync_state: { starling_max: date },
        })
      ).structuredContent,
    );
    expect(result.flags).toContainEqual(
      expect.objectContaining({ check: 'feed_health', account: 'plaid_max', severity: 'info' }),
    );
  });

  it('checks caller-supplied feed, statement, watch and anchor data', async () => {
    const result = financeWealthIntegrityOutputSchema.parse(
      (
        await callTool(userId, 'finance_wealth_integrity', {
          date,
          run_id: 8,
          sync_state: { starling_max: '2026-11-21', plaid_max: '2026-11-01' },
          manual_anchors: { 'Synthetic Saver': 10 },
          cancellation_watches: [
            {
              id: 'watch-1',
              merchant: 'Cafe Nova',
              status: 'open',
              escalate_if: 'charged after 2026-11-20; confirm by 2026-11-21',
            },
            {
              id: 'watch-2',
              merchant: 'Synthetic Vacuum',
              status: 'open',
              escalate_if: 'charged after 2026-11-20',
            },
          ],
          plaid: {
            accounts: [
              {
                account_id: 'sample-card',
                mask: '4242',
                type: 'credit',
                balances: { current: 230, iso_currency_code: 'USD' },
              },
            ],
            transactions: [{ account_id: 'sample-card', date, amount: 10, pending: false }],
            liabilities: {
              accounts: [{ account_id: 'sample-card', mask: '4242' }],
              liabilities: {
                credit: [
                  {
                    account_id: 'sample-card',
                    last_statement_balance: 200,
                    last_statement_issue_date: '2026-11-01',
                    next_payment_due_date: '2026-11-15',
                  },
                ],
              },
            },
          },
          starling: {
            feeds: [
              {
                accountUid: 'synthetic-starling',
                currency: 'GBP',
                space: null,
                feedItems: [
                  {
                    status: 'SETTLED',
                    direction: 'OUT',
                    amount: { minorUnits: 6000 },
                    transactionTime: '2026-11-21T12:00:00.000Z',
                  },
                ],
              },
            ],
          },
        })
      ).structuredContent,
    );
    expect(result).toMatchObject({ ok: true, date, run_id: 8 });
    expect(result.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ check: 'feed_health', account: 'plaid_max' }),
        expect.objectContaining({
          check: 'balance_drift',
          account: 'Synthetic Card',
          detail: expect.stringContaining('unexplained residual +20.00'),
        }),
        expect.objectContaining({
          check: 'starling_reconciliation',
          account: 'Synthetic Checking',
          detail: expect.stringContaining('difference -60.00'),
        }),
        expect.objectContaining({ check: 'anchor_freshness', account: 'Synthetic Saver' }),
        expect.objectContaining({ check: 'cancellation_watch', account: 'Cafe Nova' }),
        expect.objectContaining({
          check: 'payment_verification',
          account: 'Synthetic Card',
          detail: expect.stringContaining('short 200.00'),
        }),
      ]),
    );
    expect(result.info).toMatchObject({
      liability_cards: 1,
      starling_window: {
        'Synthetic Checking': { from: '2026-11-20', feed_sum: -60, ledger_sum: -120 },
      },
    });
    expect(
      result.flags.filter(
        (flag) => flag.check === 'cancellation_watch' && flag.detail.includes('CHARGE POSTED'),
      ),
    ).toHaveLength(2);
    expect(result.flags.some((flag) => flag.account === 'Synthetic Vacuum')).toBe(false);
  });

  it('skips drift when the supplied Plaid window starts after the ledger max date', async () => {
    const result = financeWealthIntegrityOutputSchema.parse(
      (
        await callTool(userId, 'finance_wealth_integrity', {
          date,
          plaid: {
            accounts: [
              {
                account_id: 'sample-card',
                mask: '4242',
                type: 'credit',
                balances: { current: 230, iso_currency_code: 'USD' },
              },
            ],
            transactions: [],
            transactions_since: date,
          },
        })
      ).structuredContent,
    );
    expect(result.flags).toContainEqual(
      expect.objectContaining({
        check: 'balance_drift',
        account: 'Synthetic Card',
        detail: expect.stringContaining(`Plaid transactions start ${date}`),
      }),
    );
    expect(result.info.plaid_drift).toEqual({ 'Synthetic Card': null });
  });

  it('reads every registered bill rather than silently truncating the snapshot at 50', async () => {
    const rows = await db
      .insertInto('app.financeBills')
      .values(
        Array.from({ length: 51 }, (_, index) => ({
          userId,
          name: `Additional bill ${index}`,
          kind: 'other',
          paymentMethod: 'manual',
          amountModel: 'fixed',
          expectedAmountCents: 100,
          currencyCode: 'GBP',
          cadence: 'monthly',
          dueDay: 25,
        })),
      )
      .returning('id')
      .execute();
    try {
      const result = financeWealthBriefOutputSchema.parse(
        (await callTool(userId, 'finance_wealth_brief', { date, bills_only: true }))
          .structuredContent,
      );
      expect(result.sections.bills?.active_bills).toBe(52);
      expect(result.snapshot?.bills).toHaveLength(52);
      expect(result.sections.bills?.due_soon).toHaveLength(52);
    } finally {
      await db
        .deleteFrom('app.financeBills')
        .where(
          'id',
          'in',
          rows.map((row) => row.id),
        )
        .execute();
    }
  });

  it('does not count late or pending payments as paid within the statement grace window', async () => {
    const lateId = await transaction({
      accountId: cardId,
      date: '2026-11-20',
      merchant: 'Late card payment',
      amount: 200,
      currency: 'USD',
    });
    const pendingId = await transaction({
      accountId: cardId,
      date: '2026-11-10',
      merchant: 'Pending card payment',
      amount: 200,
      currency: 'USD',
      pending: true,
    });
    try {
      const result = financeWealthIntegrityOutputSchema.parse(
        (
          await callTool(userId, 'finance_wealth_integrity', {
            date,
            plaid: {
              accounts: [],
              liabilities: {
                accounts: [{ account_id: 'sample-card', mask: '4242' }],
                liabilities: {
                  credit: [
                    {
                      account_id: 'sample-card',
                      last_statement_balance: 200,
                      last_statement_issue_date: '2026-11-01',
                      next_payment_due_date: '2026-11-15',
                    },
                  ],
                },
              },
            },
          })
        ).structuredContent,
      );
      expect(result.flags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            check: 'payment_verification',
            detail: expect.stringContaining('short 200.00'),
          }),
        ]),
      );
    } finally {
      await db
        .deleteFrom('app.financeTransactions')
        .where('id', 'in', [lateId, pendingId])
        .execute();
    }
  });

  it('names missing provider balances and liability failures instead of reporting a quiet check', async () => {
    const result = financeWealthIntegrityOutputSchema.parse(
      (
        await callTool(userId, 'finance_wealth_integrity', {
          date,
          plaid: {
            accounts: [{ account_id: 'sample-card', mask: '4242' }],
            liabilities_skipped: [{ institution: 'Mock Bank', error: 'not available' }],
          },
        })
      ).structuredContent,
    );
    expect(result.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check: 'balance_drift',
          account: 'Synthetic Card',
          severity: 'info',
          detail: expect.stringContaining('balance was not supplied'),
        }),
        expect.objectContaining({
          check: 'payment_verification',
          severity: 'info',
          detail: expect.stringContaining('liability data was not supplied'),
        }),
      ]),
    );
    expect(result.info.liabilities_skipped).toEqual([
      { institution: 'Mock Bank', error: 'not available' },
    ]);
  });

  it('reconciles all same-day Starling rows beyond a single search page', async () => {
    const ids = await Promise.all(
      Array.from({ length: 60 }, (_, index) =>
        transaction({
          accountId: checkingId,
          date: '2026-11-21',
          merchant: 'Pagination fixture',
          amount: -1,
          currency: 'GBP',
          source: 'starling',
          externalId: `wealth-page-${index}`,
        }),
      ),
    );
    try {
      const result = financeWealthIntegrityOutputSchema.parse(
        (
          await callTool(userId, 'finance_wealth_integrity', {
            date,
            sync_state: { starling_max: '2026-11-21', plaid_max: '2026-11-21' },
            starling: {
              feeds: [
                {
                  accountUid: 'synthetic-starling',
                  currency: 'GBP',
                  space: null,
                  feedItems: [
                    {
                      status: 'SETTLED',
                      direction: 'OUT',
                      amount: { minorUnits: 18000 },
                      transactionTime: '2026-11-21T12:00:00.000Z',
                    },
                  ],
                },
              ],
            },
          })
        ).structuredContent,
      );
      expect(result.info).toMatchObject({
        starling_window: {
          'Synthetic Checking': { from: '2026-11-20', feed_sum: -180, ledger_sum: -180 },
        },
      });
      expect(result.flags.filter((flag) => flag.check === 'starling_reconciliation')).toEqual([]);
    } finally {
      await db.deleteFrom('app.financeTransactions').where('id', 'in', ids).execute();
    }
  });

  it('never includes another owner’s ledger, accounts or bills in any report', async () => {
    const requests = [
      ['finance_wealth_brief', { date }],
      ['finance_wealth_look', { as_of: date }],
      ['finance_wealth_close', { month: '2026-11', today: date }],
      ['finance_wealth_integrity', { date }],
    ] as const;
    for (const [tool, input] of requests) {
      const mine = JSON.stringify((await callTool(userId, tool, input)).structuredContent);
      const other = JSON.stringify((await callTool(otherUserId, tool, input)).structuredContent);
      expect(mine).not.toContain('Other Private Merchant');
      expect(mine).not.toContain('Other Checking');
      expect(other).not.toContain('Synthetic Checking');
      expect(other).not.toContain('Synthetic Card');
      expect(other).not.toContain('Sample Rent');
      expect(other).not.toContain('Cafe Nova');
    }
  });
});

function auth(id: string): AuthContext {
  return {
    userId: id,
    credential: 'session',
    scopes: [],
    user: {
      id,
      name: 'Synthetic Wealth User',
      email: `${id}@test.hominem.dev`,
      emailVerified: true,
      image: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  };
}

const app = new Hono<AppContext>()
  .onError(apiErrorHandler)
  .use('*', async (context, next) => {
    const fixture = context.req.header('x-wealth-fixture');
    if (fixture === 'owner') context.set('auth', auth(userId));
    if (fixture === 'other') context.set('auth', auth(otherUserId));
    await next();
  })
  .route('/api/finance', financeRoutes);

function request(path: string, body: unknown, fixture?: 'owner' | 'other') {
  return app.request(`/api/finance/wealth/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(fixture ? { 'x-wealth-fixture': fixture } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('wealth report RPC', () => {
  it.each(['brief', 'look', 'close', 'integrity'])(
    'requires authentication for %s',
    async (path) => {
      expect((await request(path, {})).status).toBe(401);
    },
  );

  it.each([
    ['brief', 'finance_wealth_brief', { date, bills_only: true }],
    ['look', 'finance_wealth_look', { as_of: date }],
    ['close', 'finance_wealth_close', { month: '2026-10', today: date }],
    ['integrity', 'finance_wealth_integrity', { date }],
  ])(
    'uses the same owner-scoped %s implementation and schema as MCP',
    async (path, tool, input) => {
      const response = await request(path, input, 'owner');
      expect(response.status).toBe(200);
      const rpc = await response.json();
      const mcp = (await callTool(userId, tool, input)).structuredContent;
      expect(rpc).toEqual(mcp);
    },
  );

  it('requires a session, rejects untrusted identity fields and uses the authenticated owner', async () => {
    expect((await request('brief', { date, userId }, 'other')).status).toBe(400);
    expect((await request('brief', { date: 'not-a-date' }, 'owner')).status).toBe(400);
    const response = await request('brief', { date }, 'other');
    expect(response.status).toBe(200);
    const result = financeWealthBriefOutputSchema.parse(await response.json());
    expect(result.sections.money_in_out?.per_currency.GBP).toMatchObject({ out: 999 });
    expect(JSON.stringify(result)).not.toContain('Cafe Nova');
  });
});
