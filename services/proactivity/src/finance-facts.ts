import type { Evidence, StateSnapshot } from './types.js';

/**
 * Fact builders that project raw domain rows into the engine's evidence
 * contract. Inputs are plain row shapes, deliberately decoupled from any
 * database client: the adapter that queries the database maps its rows to
 * these types, and everything here is pure and unit-testable.
 */

export type MonthlyFlow = { month: string; income: number; spend: number };
export type CategorySpend = { month: string; category: string; spend: number };
export type IncomeEvent = { date: string; source: string; amount: number };

/** Signed account movement: credits positive, debits negative. */
export type AccountFlow = {
  date: string;
  direction: 'credit' | 'debit';
  merchant: string;
  amount: number;
};

export type TransferPair = { out: AccountFlow; in: AccountFlow };

export type Reconciliation = {
  pairs: TransferPair[];
  nettedGbp: number;
  unmatched: AccountFlow[];
};

/**
 * Matches same-amount credit/debit pairs within a few days of each other —
 * internal movements between a person's own accounts that would otherwise
 * double-count as both income and spend. Greedy first match on date order.
 */
export function reconcileTransferPairs(flows: AccountFlow[], toleranceDays = 3): Reconciliation {
  const unmatchedDebits = flows
    .filter((flow) => flow.direction === 'debit')
    .map((flow) => ({ flow, matched: false }));
  const pairs: TransferPair[] = [];
  for (const credit of flows.filter((flow) => flow.direction === 'credit')) {
    const match = unmatchedDebits.find(
      (candidate) =>
        !candidate.matched &&
        Math.abs(Math.abs(round2(candidate.flow.amount)) - round2(credit.amount)) < 0.005 &&
        Math.abs(daysBetween(candidate.flow.date, credit.date)) <= toleranceDays,
    );
    if (match) {
      match.matched = true;
      pairs.push({ out: match.flow, in: credit });
    }
  }
  const matchedOutIds = new Set(pairs.map((pair) => pair.out));
  return {
    pairs,
    nettedGbp: round2(pairs.reduce((sum, pair) => sum + pair.in.amount, 0)),
    unmatched: flows.filter((flow) =>
      flow.direction === 'debit'
        ? !matchedOutIds.has(flow)
        : !pairs.some((pair) => pair.in === flow),
    ),
  };
}

/**
 * Removes matched transfer pairs from the monthly series so income and spend
 * stop double-counting internal movements. Months without pairs pass through.
 */
export function adjustMonthlyFlows(months: MonthlyFlow[], pairs: TransferPair[]): MonthlyFlow[] {
  const byMonth = new Map(months.map((month) => [month.month, { ...month }]));
  for (const pair of pairs) {
    const incomeMonth = byMonth.get(pair.in.date.slice(0, 7));
    if (incomeMonth) incomeMonth.income = round2(incomeMonth.income - pair.in.amount);
    const spendMonth = byMonth.get(pair.out.date.slice(0, 7));
    if (spendMonth) spendMonth.spend = round2(spendMonth.spend - Math.abs(pair.out.amount));
  }
  return months.map((month) => byMonth.get(month.month) ?? month);
}

export type FinanceSnapshotInput = {
  ownerId: string;
  /** Monthly flows ascending by month; the last entry may be a partial month. */
  months: MonthlyFlow[];
  categories: CategorySpend[];
  incomeEvents: IncomeEvent[];
  recentFlows: AccountFlow[];
  openAccountsByType: { accountType: string; accounts: number }[];
  /** ISO timestamp of the extraction; defines what counts as "current". */
  generatedAt: string;
  source?: string;
};

/**
 * Builds the previous/current finance snapshots for a goal context: the
 * previous full month against the current (often partial) month, with
 * reconciled transfer pairs reported as their own evidence.
 */
export function buildFinanceSnapshots(input: FinanceSnapshotInput): {
  previous: StateSnapshot | null;
  current: StateSnapshot;
} {
  const source = input.source ?? 'hominem database';
  const currentMonth = input.months[input.months.length - 1];
  const previousMonth = input.months.length >= 2 ? input.months[input.months.length - 2] : null;
  const currentIsPartial = currentMonth.month === input.generatedAt.slice(0, 7);
  const reconciliation = reconcileTransferPairs(input.recentFlows);
  const adjustedMonths = adjustMonthlyFlows(input.months, reconciliation.pairs);

  const previous = previousMonth
    ? {
        id: 'snap-fin-previous',
        asOf: monthEndIso(previousMonth.month),
        evidence: [
          evidence(
            `ev-fin-${previousMonth.month}-flows`,
            'finance',
            monthEndIso(previousMonth.month),
            source,
            {
              month: previousMonth.month,
              incomeGbp: round2(previousMonth.income),
              spendGbp: round2(previousMonth.spend),
              netGbp: round2(previousMonth.income - previousMonth.spend),
              partial: false,
            },
          ),
          evidence(
            `ev-fin-${previousMonth.month}-categories`,
            'finance',
            monthEndIso(previousMonth.month),
            source,
            { top: topCategories(input.categories, previousMonth.month) },
          ),
        ],
      }
    : null;

  const current: StateSnapshot = {
    id: 'snap-fin-current',
    asOf: input.generatedAt,
    evidence: [
      evidence(`ev-fin-${currentMonth.month}-flows`, 'finance', input.generatedAt, source, {
        month: currentMonth.month,
        incomeGbp: round2(currentMonth.income),
        spendGbp: round2(currentMonth.spend),
        netGbp: round2(currentMonth.income - currentMonth.spend),
        adjustedNetGbp: round2(
          (adjustedMonths.find((month) => month.month === currentMonth.month)?.income ?? 0) -
            (adjustedMonths.find((month) => month.month === currentMonth.month)?.spend ?? 0),
        ),
        partial: currentIsPartial,
      }),
      evidence(`ev-fin-${currentMonth.month}-categories`, 'finance', input.generatedAt, source, {
        top: topCategories(input.categories, currentMonth.month),
      }),
      evidence('ev-fin-income-recent', 'finance', input.generatedAt, source, {
        windowDays: 45,
        events: input.incomeEvents.slice(0, 8),
        totalGbp: round2(input.incomeEvents.reduce((sum, event) => sum + event.amount, 0)),
      }),
      evidence('ev-fin-transfer-pairs', 'finance', input.generatedAt, source, {
        matchedPairs: reconciliation.pairs.length,
        nettedGbp: reconciliation.nettedGbp,
        note: 'same-amount credit/debit pairs within 3 days treated as internal transfers, not income or spend',
      }),
      evidence('ev-fin-accounts', 'finance', input.generatedAt, source, {
        openAccountsByType: input.openAccountsByType,
      }),
    ],
  };

  return { previous, current };
}

export type CareerPipelineInput = {
  lastApplicationDate: string;
  totalApplications: number;
  applicationsLast120Days: number;
  source?: string;
};

/**
 * The career pipeline snapshot. Its newest evidence is deliberately dated at
 * the last application: a quiet pipeline becomes stale evidence, which the
 * slot's preflight turns into a defer without a model call.
 */
export function buildCareerSnapshot(input: CareerPipelineInput): StateSnapshot {
  const source = input.source ?? 'hominem database';
  const observedAt = `${input.lastApplicationDate}T12:00:00.000Z`;
  return {
    id: 'snap-career-current',
    asOf: observedAt,
    evidence: [
      evidence('ev-career-pipeline', 'career', observedAt, source, {
        totalApplications: input.totalApplications,
        lastApplicationDate: input.lastApplicationDate,
        applicationsLast120Days: input.applicationsLast120Days,
      }),
    ],
  };
}

function evidence(
  id: string,
  domain: string,
  observedAt: string,
  source: string,
  facts: Record<string, unknown>,
): Evidence {
  return { id, domain, source, observedAt, facts };
}

function topCategories(categories: CategorySpend[], month: string): CategorySpend[] {
  return categories.filter((row) => row.month === month).slice(0, 6);
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

function monthEndIso(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const end = new Date(Date.UTC(year, monthNumber, 0));
  return `${end.toISOString().slice(0, 10)}T12:00:00.000Z`;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}
