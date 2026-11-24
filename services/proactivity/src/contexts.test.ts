import { describe, expect, it } from 'vitest';

import {
  createCareerContextLoader,
  createDomainContextAssembler,
  createFinanceContextLoader,
} from './contexts.js';
import {
  adjustMonthlyFlows,
  buildCareerSnapshot,
  buildFinanceSnapshots,
  reconcileTransferPairs,
  type AccountFlow,
  type MonthlyFlow,
} from './finance-facts.js';
import {
  goalContextSchema,
  goalSchema,
  proactivityTriggerSchema,
  stateSnapshotSchema,
} from './types.js';

const GENERATED_AT = '2026-11-23T09:00:00.000Z';

const makeTrigger = () =>
  proactivityTriggerSchema.parse({
    kind: 'critical-change',
    id: 'trigger-1',
    ownerId: 'person-1',
    changedDomains: ['finance', 'career'],
    occurredAt: GENERATED_AT,
  });

const months: MonthlyFlow[] = [
  { month: '2026-09', income: 8924.42, spend: 25497.64 },
  { month: '2026-10', income: 29044.55, spend: 26405.41 },
  { month: '2026-11', income: 7765.06, spend: 13722.18 },
];

// Real shapes from the restored production data: an internal savings movement
// and a currency conversion both appear as credit/debit pairs.
const flows: AccountFlow[] = [
  { date: '2026-10-20', direction: 'debit', merchant: 'Charles Ponti (Sent)', amount: -2465.98 },
  { date: '2026-10-20', direction: 'credit', merchant: 'To GBP (Added)', amount: 2465.98 },
  { date: '2026-10-23', direction: 'debit', merchant: 'savings', amount: -3689.28 },
  { date: '2026-10-23', direction: 'credit', merchant: 'Charles Ponti', amount: 3689.28 },
  { date: '2026-10-24', direction: 'debit', merchant: 'Rentbrella', amount: -1800 },
  {
    date: '2026-11-11',
    direction: 'credit',
    merchant: 'Deposit from savings XXXXXXX3196',
    amount: 3601.83,
  },
];

describe('reconcileTransferPairs', () => {
  it('matches same-amount credit/debit pairs within the tolerance window', () => {
    const { pairs, nettedGbp } = reconcileTransferPairs(flows);
    expect(pairs).toHaveLength(2);
    expect(pairs.map((pair) => pair.in.amount).sort()).toEqual([2465.98, 3689.28]);
    expect(nettedGbp).toBe(6155.26);
  });

  it('does not match flows with different amounts or beyond the window', () => {
    const { pairs } = reconcileTransferPairs([
      { date: '2026-11-01', direction: 'credit', merchant: 'A', amount: 500 },
      { date: '2026-11-01', direction: 'debit', merchant: 'B', amount: -499.99 },
      { date: '2026-11-10', direction: 'debit', merchant: 'C', amount: -500 },
    ]);
    expect(pairs).toHaveLength(0);
  });

  it('honors a tighter tolerance', () => {
    const { pairs } = reconcileTransferPairs(
      [
        { date: '2026-10-20', direction: 'debit', merchant: 'X', amount: -100 },
        { date: '2026-10-23', direction: 'credit', merchant: 'Y', amount: 100 },
      ],
      2,
    );
    expect(pairs).toHaveLength(0);
  });

  it('leaves genuine income and spend unmatched', () => {
    const { unmatched } = reconcileTransferPairs(flows);
    expect(unmatched.map((flow) => flow.merchant)).toEqual([
      'Rentbrella',
      'Deposit from savings XXXXXXX3196',
    ]);
  });
});

describe('adjustMonthlyFlows', () => {
  it('removes matched pair amounts from the months they landed in', () => {
    const { pairs } = reconcileTransferPairs(flows);
    const adjusted = adjustMonthlyFlows(months, pairs);
    const october = adjusted.find((month) => month.month === '2026-10');
    expect(october?.income).toBe(29044.55 - 2465.98 - 3689.28);
    expect(october?.spend).toBe(26405.41 - 2465.98 - 3689.28);
    const november = adjusted.find((month) => month.month === '2026-11');
    expect(november?.income).toBe(7765.06);
  });

  it('passes months without pairs through unchanged', () => {
    const adjusted = adjustMonthlyFlows(months, []);
    expect(adjusted).toEqual(months);
  });
});

describe('buildFinanceSnapshots', () => {
  const input = {
    ownerId: 'person-1',
    months,
    categories: [
      { month: '2026-10', category: 'Rent', spend: 3250 },
      { month: '2026-10', category: 'Travel', spend: 2218.89 },
      { month: '2026-11', category: 'Rent', spend: 3250 },
    ],
    incomeEvents: [{ date: '2026-10-23', source: 'Rippling', amount: 8212.1 }],
    recentFlows: flows,
    openAccountsByType: [{ accountType: 'checking', accounts: 3 }],
    generatedAt: GENERATED_AT,
  };

  it('produces contract-valid snapshots', () => {
    const { previous, current } = buildFinanceSnapshots(input);
    expect(stateSnapshotSchema.parse(previous)).toBeTruthy();
    expect(stateSnapshotSchema.parse(current)).toBeTruthy();
  });

  it('flags the current month partial against generatedAt', () => {
    const { current } = buildFinanceSnapshots(input);
    const flowsEvidence = current.evidence.find((e) => e.id === 'ev-fin-2026-11-flows');
    expect(flowsEvidence?.facts.partial).toBe(true);
    expect(flowsEvidence?.facts.netGbp).toBe(-5957.12);
  });

  it('reports previous and current gross figures net of internal transfers', () => {
    const { previous, current } = buildFinanceSnapshots(input);
    const october = previous?.evidence.find((e) => e.id === 'ev-fin-2026-10-flows');
    expect(october?.facts).toMatchObject({
      incomeGbp: 22889.29,
      spendGbp: 20250.15,
      netGbp: 2639.14,
      adjustedForTransfers: true,
    });
    const november = current.evidence.find((e) => e.id === 'ev-fin-2026-11-flows');
    expect(november?.facts).toMatchObject({
      incomeGbp: 7765.06,
      spendGbp: 13722.18,
      adjustedForTransfers: true,
    });
  });

  it('dates previous evidence at the end of the previous month', () => {
    const { previous } = buildFinanceSnapshots(input);
    expect(previous?.asOf).toBe('2026-10-31T12:00:00.000Z');
    expect(previous?.evidence.map((e) => e.id)).toEqual([
      'ev-fin-2026-10-flows',
      'ev-fin-2026-10-categories',
    ]);
  });

  it('reports the reconciliation as its own evidence', () => {
    const { current } = buildFinanceSnapshots(input);
    const pairs = current.evidence.find((e) => e.id === 'ev-fin-transfer-pairs');
    expect(pairs?.facts.matchedPairs).toBe(2);
    expect(pairs?.facts.nettedGbp).toBe(6155.26);
  });

  it('keeps matched transfer credits out of the recent income evidence', () => {
    const { current } = buildFinanceSnapshots({
      ...input,
      incomeEvents: [
        ...input.incomeEvents,
        { date: '2026-10-20', source: 'To GBP (Added)', amount: 2465.98 },
      ],
    });
    const income = current.evidence.find((e) => e.id === 'ev-fin-income-recent');
    expect(income?.facts.totalGbp).toBe(8212.1);
    expect(income?.facts.excludedTransferCredits).toBe(1);
  });

  it('caps category lists at six entries', () => {
    const manyCategories = Array.from({ length: 9 }, (_, index) => ({
      month: '2026-11',
      category: `Category ${index}`,
      spend: 100 - index,
    }));
    const { current } = buildFinanceSnapshots({ ...input, categories: manyCategories });
    const categories = current.evidence.find((e) => e.id === 'ev-fin-2026-11-categories');
    if (!categories) throw new Error('category evidence missing');
    const top = categories.facts.top;
    if (!Array.isArray(top)) throw new Error('category list missing');
    expect(top.length).toBe(6);
  });

  it('returns a null previous snapshot with a single month of history', () => {
    const { previous } = buildFinanceSnapshots({ ...input, months: [months[2]] });
    expect(previous).toBeNull();
  });
});

describe('buildCareerSnapshot', () => {
  it('dates the newest evidence at the last application', () => {
    const snapshot = buildCareerSnapshot({
      lastApplicationDate: '2025-02-23',
      totalApplications: 135,
      applicationsLast120Days: 0,
    });
    expect(snapshot.asOf).toBe('2025-02-23T12:00:00.000Z');
    const pipeline = snapshot.evidence.find((e) => e.id === 'ev-career-pipeline');
    expect(pipeline?.facts.applicationsLast120Days).toBe(0);
    expect(stateSnapshotSchema.parse(snapshot)).toBeTruthy();
  });
});

describe('createDomainContextAssembler', () => {
  it('routes goals to the loader for their first covered domain', async () => {
    const assembler = createDomainContextAssembler({
      finance: createFinanceContextLoader({
        ownerId: 'person-1',
        months,
        categories: [],
        incomeEvents: [],
        recentFlows: flows,
        openAccountsByType: [],
        generatedAt: GENERATED_AT,
      }),
      career: createCareerContextLoader({
        lastApplicationDate: '2025-02-23',
        totalApplications: 135,
        applicationsLast120Days: 0,
      }),
    });
    const trigger = makeTrigger();
    const goal = goalSchema.parse({
      id: 'g-budget',
      ownerId: 'person-1',
      title: 'Stay inside the monthly plan',
      status: 'active',
      domains: ['finance'],
    });

    const context = await assembler.load(goal, trigger);
    expect(goalContextSchema.parse(context)).toBeTruthy();
    expect(context.goal.id).toBe('g-budget');
    expect(context.trigger.id).toBe('trigger-1');
    expect(context.previous).not.toBeNull();
    expect(context.current.id).toBe('snap-fin-current');
  });

  it('gives career goals a null previous snapshot', async () => {
    const assembler = createDomainContextAssembler({
      career: createCareerContextLoader({
        lastApplicationDate: '2025-02-23',
        totalApplications: 135,
        applicationsLast120Days: 0,
      }),
    });
    const goal = goalSchema.parse({
      id: 'g-role',
      ownerId: 'person-1',
      title: 'Find a better role',
      status: 'active',
      domains: ['career'],
    });
    const context = await assembler.load(goal, makeTrigger());
    expect(context.previous).toBeNull();
    expect(context.current.evidence[0]?.id).toBe('ev-career-pipeline');
  });

  it('fails loudly when no loader covers the goal', async () => {
    const assembler = createDomainContextAssembler({});
    const goal = goalSchema.parse({
      id: 'g-health',
      ownerId: 'person-1',
      title: 'Run a half marathon',
      status: 'active',
      domains: ['health'],
    });
    await expect(assembler.load(goal, makeTrigger())).rejects.toThrow(
      'No context loader covers goal g-health',
    );
  });
});
