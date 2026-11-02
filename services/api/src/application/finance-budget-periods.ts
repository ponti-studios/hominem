import type { FinanceBudgetCadence } from '@hominem/db/finance';

/**
 * A budget's period is a calendar period derived from its cadence — never a user-set start
 * date. Dates are UTC calendar dates and `endsOn` is inclusive.
 */
export type BudgetPeriod = { startsOn: string; endsOn: string };

export type BudgetPace = {
  periodElapsedFraction: number;
  spentFraction: number | null;
  projectedSpendCents: number | null;
  projectedExhaustionDate: string | null;
  paceStatus: 'insufficient_data' | 'on_track' | 'ahead';
};

/** No pace verdict is returned before 20% of the period has elapsed, on every cadence. */
export const PACE_GATE_FRACTION = 0.2;

const DAY_MS = 86_400_000;

function atUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** The calendar period containing `at` for the cadence: Mon–Sun, month, quarter, or year. */
export function periodFor(cadence: FinanceBudgetCadence, at: Date): BudgetPeriod {
  const year = at.getUTCFullYear();
  const month = at.getUTCMonth();

  switch (cadence) {
    case 'weekly': {
      const day = atUtcMidnight(at);
      const mondayOffset = (day.getUTCDay() + 6) % 7;
      const startsOn = addDays(day, -mondayOffset);
      return { startsOn: toIsoDate(startsOn), endsOn: toIsoDate(addDays(startsOn, 6)) };
    }
    case 'monthly':
      return {
        startsOn: toIsoDate(new Date(Date.UTC(year, month, 1))),
        endsOn: toIsoDate(new Date(Date.UTC(year, month + 1, 0))),
      };
    case 'quarterly': {
      const quarterStart = Math.floor(month / 3) * 3;
      return {
        startsOn: toIsoDate(new Date(Date.UTC(year, quarterStart, 1))),
        endsOn: toIsoDate(new Date(Date.UTC(year, quarterStart + 3, 0))),
      };
    }
    case 'annual':
      return {
        startsOn: toIsoDate(new Date(Date.UTC(year, 0, 1))),
        endsOn: toIsoDate(new Date(Date.UTC(year, 11, 31))),
      };
  }
}

/** The calendar period containing a timestamp (a budget's createdAt, for its tracking start). */
export function periodContaining(cadence: FinanceBudgetCadence, timestamp: string | Date) {
  return periodFor(cadence, new Date(timestamp));
}

export function previousPeriod(cadence: FinanceBudgetCadence, period: BudgetPeriod): BudgetPeriod {
  return periodFor(cadence, addDays(parseIsoDate(period.startsOn), -1));
}

export function nextPeriod(cadence: FinanceBudgetCadence, period: BudgetPeriod): BudgetPeriod {
  return periodFor(cadence, addDays(parseIsoDate(period.endsOn), 1));
}

/** Whole periods from one calendar period's start to another's. Always exact by construction. */
export function periodsBetween(
  cadence: FinanceBudgetCadence,
  from: BudgetPeriod,
  to: BudgetPeriod,
): number {
  const start = parseIsoDate(from.startsOn);
  const end = parseIsoDate(to.startsOn);
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  switch (cadence) {
    case 'weekly':
      return Math.round((end.getTime() - start.getTime()) / (7 * DAY_MS));
    case 'monthly':
      return months;
    case 'quarterly':
      return Math.round(months / 3);
    case 'annual':
      return end.getUTCFullYear() - start.getUTCFullYear();
  }
}

/** Inclusive day count of a period. */
export function periodDayCount(period: BudgetPeriod): number {
  const start = parseIsoDate(period.startsOn);
  const end = parseIsoDate(period.endsOn);
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

export function periodElapsedFraction(period: BudgetPeriod, now: Date): number {
  const start = parseIsoDate(period.startsOn).getTime();
  const endExclusive = parseIsoDate(period.endsOn).getTime() + DAY_MS;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (endExclusive - start)));
}

/**
 * Pace is projected from the current rate against the period's available amount. The verdict
 * is withheld until PACE_GATE_FRACTION of the period has elapsed, because a single early
 * purchase would make any projection nonsense.
 */
export function computePace(input: {
  period: BudgetPeriod;
  now: Date;
  spentCents: number;
  availableCents: number;
}): BudgetPace {
  const elapsed = periodElapsedFraction(input.period, input.now);
  const spentFraction = input.availableCents > 0 ? input.spentCents / input.availableCents : null;
  const projectedSpendCents = elapsed > 0 ? Math.round(input.spentCents / elapsed) : null;

  const start = parseIsoDate(input.period.startsOn).getTime();
  const elapsedDays = (input.now.getTime() - start) / DAY_MS;
  const projectedExhaustionDate = (() => {
    if (input.spentCents <= 0 || input.availableCents <= 0 || elapsedDays <= 0) return null;
    const ratePerDay = input.spentCents / elapsedDays;
    const daysToExhaustion = Math.floor(input.availableCents / ratePerDay);
    const exhaustion = addDays(parseIsoDate(input.period.startsOn), daysToExhaustion);
    return toIsoDate(exhaustion) > input.period.endsOn ? null : toIsoDate(exhaustion);
  })();

  const paceStatus =
    elapsed < PACE_GATE_FRACTION
      ? 'insufficient_data'
      : (projectedSpendCents ?? 0) > input.availableCents
        ? 'ahead'
        : 'on_track';

  return {
    periodElapsedFraction: elapsed,
    spentFraction,
    projectedSpendCents,
    projectedExhaustionDate,
    paceStatus,
  };
}

/**
 * Asymmetric rollover, folded period by period from the budget's tracking start. An overspend
 * always carries as a deficit into the next period. On weekly/monthly/quarterly budgets a
 * surplus is swept to savings and resets the balance to zero, so it never raises the next
 * period's allowance; only an annual budget carries a surplus forward in full.
 */
export function computeRollover(input: {
  cadence: FinanceBudgetCadence;
  amountCents: number;
  trackingStartsOn: string;
  currentPeriod: BudgetPeriod;
  spentByPeriodStartsOn: ReadonlyMap<string, number>;
}): { openingBalanceCents: number; sweptToSavingsCents: number } {
  let balance = 0;
  let swept = 0;
  let period = periodFor(input.cadence, parseIsoDate(input.trackingStartsOn));

  while (period.startsOn < input.currentPeriod.startsOn) {
    const spent = input.spentByPeriodStartsOn.get(period.startsOn) ?? 0;
    const leftover = input.amountCents + balance - spent;
    if (input.cadence === 'annual') {
      balance = leftover;
      swept = 0;
    } else {
      swept = Math.max(0, leftover);
      balance = Math.min(0, leftover);
    }
    period = nextPeriod(input.cadence, period);
  }

  return { openingBalanceCents: balance, sweptToSavingsCents: swept };
}
