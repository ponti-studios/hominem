import { describe, expect, it } from 'vitest';

import {
  computePace,
  computeRollover,
  periodFor,
  periodsBetween,
  previousPeriod,
} from './finance-budget-periods';

describe('calendar periods', () => {
  it('maps every cadence to its calendar period', () => {
    // 2026-11-01 is a Sunday.
    const at = new Date('2026-11-01T12:00:00.000Z');
    expect(periodFor('weekly', at)).toEqual({ startsOn: '2026-10-26', endsOn: '2026-11-01' });
    expect(periodFor('monthly', at)).toEqual({ startsOn: '2026-11-01', endsOn: '2026-11-30' });
    expect(periodFor('quarterly', at)).toEqual({ startsOn: '2026-10-01', endsOn: '2026-12-31' });
    expect(periodFor('annual', at)).toEqual({ startsOn: '2026-01-01', endsOn: '2026-12-31' });
  });

  it('counts whole calendar periods between two periods', () => {
    const march = periodFor('monthly', new Date('2026-03-15T00:00:00.000Z'));
    const april = periodFor('monthly', new Date('2026-04-15T00:00:00.000Z'));
    expect(periodsBetween('monthly', march, april)).toBe(1);
    expect(
      periodsBetween(
        'quarterly',
        periodFor('quarterly', new Date('2026-01-15T00:00:00Z')),
        periodFor('quarterly', new Date('2026-10-15T00:00:00Z')),
      ),
    ).toBe(3);
    expect(
      periodsBetween(
        'annual',
        periodFor('annual', new Date('2026-06-01T00:00:00Z')),
        periodFor('annual', new Date('2028-06-01T00:00:00Z')),
      ),
    ).toBe(2);
    expect(
      periodsBetween(
        'weekly',
        periodFor('weekly', new Date('2026-11-01T00:00:00Z')),
        periodFor('weekly', new Date('2026-11-15T00:00:00Z')),
      ),
    ).toBe(2);
  });

  it('finds the previous period', () => {
    expect(previousPeriod('monthly', { startsOn: '2026-04-01', endsOn: '2026-04-30' })).toEqual({
      startsOn: '2026-03-01',
      endsOn: '2026-03-31',
    });
    expect(previousPeriod('annual', { startsOn: '2027-01-01', endsOn: '2027-12-31' })).toEqual({
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
    });
  });
});

describe('asymmetric rollover', () => {
  const money = (entries: Record<string, number>) => new Map(Object.entries(entries));

  it('carries a monthly overspend as a deficit into the next period', () => {
    const rollover = computeRollover({
      cadence: 'monthly',
      amountCents: 30_000,
      trackingStartsOn: '2026-01-01',
      currentPeriod: { startsOn: '2026-04-01', endsOn: '2026-04-30' },
      spentByPeriodStartsOn: money({ '2026-03-01': 34_000 }),
    });
    expect(rollover.openingBalanceCents).toBe(-4_000);
    expect(30_000 + rollover.openingBalanceCents).toBe(26_000);
  });

  it('sweeps a monthly underspend to savings instead of carrying it', () => {
    const rollover = computeRollover({
      cadence: 'monthly',
      amountCents: 30_000,
      trackingStartsOn: '2026-01-01',
      currentPeriod: { startsOn: '2026-04-01', endsOn: '2026-04-30' },
      spentByPeriodStartsOn: money({ '2026-03-01': 25_000 }),
    });
    expect(rollover.openingBalanceCents).toBe(0);
    expect(rollover.sweptToSavingsCents).toBe(5_000);
  });

  it('keeps a deficit across several periods', () => {
    // February 30_000 spent exactly, March 34_000 (deficit 4_000), April 28_000 of an
    // available 26_000 — the April overage joins the deficit.
    const rollover = computeRollover({
      cadence: 'monthly',
      amountCents: 30_000,
      trackingStartsOn: '2026-01-01',
      currentPeriod: { startsOn: '2026-05-01', endsOn: '2026-05-31' },
      spentByPeriodStartsOn: money({
        '2026-02-01': 30_000,
        '2026-03-01': 34_000,
        '2026-04-01': 28_000,
      }),
    });
    expect(rollover.openingBalanceCents).toBe(-2_000);
    expect(rollover.sweptToSavingsCents).toBe(0);
  });

  it('reports the last closed period surplus after an earlier deficit', () => {
    // February 30_000, March 34_000 (deficit 4_000), April 24_000 of an available 26_000.
    const rollover = computeRollover({
      cadence: 'monthly',
      amountCents: 30_000,
      trackingStartsOn: '2026-01-01',
      currentPeriod: { startsOn: '2026-05-01', endsOn: '2026-05-31' },
      spentByPeriodStartsOn: money({
        '2026-02-01': 30_000,
        '2026-03-01': 34_000,
        '2026-04-01': 24_000,
      }),
    });
    expect(rollover.openingBalanceCents).toBe(0);
    expect(rollover.sweptToSavingsCents).toBe(2_000);
  });

  it('carries an annual underspend forward in full', () => {
    const rollover = computeRollover({
      cadence: 'annual',
      amountCents: 400_000,
      trackingStartsOn: '2026-01-01',
      currentPeriod: { startsOn: '2027-01-01', endsOn: '2027-12-31' },
      spentByPeriodStartsOn: money({ '2026-01-01': 100_000 }),
    });
    expect(rollover.openingBalanceCents).toBe(300_000);
    expect(400_000 + rollover.openingBalanceCents).toBe(700_000);
    expect(rollover.sweptToSavingsCents).toBe(0);
  });

  it('carries an annual overspend as a deficit', () => {
    // Year one spent 100_000 (300_000 carried); year two spent 750_000 of 700_000.
    const rollover = computeRollover({
      cadence: 'annual',
      amountCents: 400_000,
      trackingStartsOn: '2026-01-01',
      currentPeriod: { startsOn: '2028-01-01', endsOn: '2028-12-31' },
      spentByPeriodStartsOn: money({ '2026-01-01': 100_000, '2027-01-01': 750_000 }),
    });
    expect(rollover.openingBalanceCents).toBe(-50_000);
    expect(400_000 + rollover.openingBalanceCents).toBe(350_000);
  });

  it('carries no balance before a period has closed', () => {
    const rollover = computeRollover({
      cadence: 'monthly',
      amountCents: 30_000,
      trackingStartsOn: '2026-04-01',
      currentPeriod: { startsOn: '2026-04-01', endsOn: '2026-04-30' },
      spentByPeriodStartsOn: new Map(),
    });
    expect(rollover.openingBalanceCents).toBe(0);
    expect(rollover.sweptToSavingsCents).toBe(0);
  });
});

describe('pace', () => {
  const march = { startsOn: '2026-03-01', endsOn: '2026-03-31' };

  it('withholds the verdict before 20% of the period has elapsed', () => {
    const pace = computePace({
      period: march,
      now: new Date('2026-03-03T00:00:00.000Z'),
      spentCents: 10_000,
      availableCents: 30_000,
    });
    expect(pace.periodElapsedFraction).toBeLessThan(0.2);
    expect(pace.paceStatus).toBe('insufficient_data');
  });

  it('withholds the verdict before 20% of the period on every cadence', () => {
    const cases: Array<[Parameters<typeof periodFor>[0], string]> = [
      ['weekly', '2026-03-03'],
      ['monthly', '2026-03-03'],
      ['quarterly', '2026-01-10'],
      ['annual', '2026-02-15'],
    ];
    for (const [cadence, date] of cases) {
      const pace = computePace({
        period: periodFor(cadence, new Date(`${date}T00:00:00.000Z`)),
        now: new Date(`${date}T00:00:00.000Z`),
        spentCents: 90_000,
        availableCents: 100_000,
      });
      expect(pace.periodElapsedFraction).toBeLessThan(0.2);
      expect(pace.paceStatus).toBe('insufficient_data');
    }
  });

  it('reports ahead when the projection exceeds the available amount', () => {
    const pace = computePace({
      period: march,
      now: new Date('2026-03-10T00:00:00.000Z'),
      spentCents: 15_000,
      availableCents: 30_000,
    });
    expect(pace.paceStatus).toBe('ahead');
    expect(pace.projectedSpendCents).toBeGreaterThan(30_000);
    expect(pace.projectedExhaustionDate).toMatch(/^2026-03-\d{2}$/);
    expect(pace.projectedExhaustionDate).not.toBeNull();
  });

  it('reports on_track when the projection fits, with no exhaustion date in the period', () => {
    const annual = { startsOn: '2026-01-01', endsOn: '2026-12-31' };
    const pace = computePace({
      period: annual,
      now: new Date('2026-07-01T00:00:00.000Z'),
      spentCents: 100_000,
      availableCents: 400_000,
    });
    expect(pace.periodElapsedFraction).toBeCloseTo(0.496, 2);
    expect(pace.projectedSpendCents).toBeGreaterThan(195_000);
    expect(pace.projectedSpendCents).toBeLessThan(210_000);
    expect(pace.paceStatus).toBe('on_track');
  });

  it('never projects an exhaustion date past the period end', () => {
    const pace = computePace({
      period: march,
      now: new Date('2026-03-10T00:00:00.000Z'),
      spentCents: 1_000,
      availableCents: 30_000,
    });
    expect(pace.paceStatus).toBe('on_track');
    expect(pace.projectedExhaustionDate).toBeNull();
  });

  it('has no exhaustion date when nothing has been spent', () => {
    const pace = computePace({
      period: march,
      now: new Date('2026-03-10T00:00:00.000Z'),
      spentCents: 0,
      availableCents: 30_000,
    });
    expect(pace.projectedExhaustionDate).toBeNull();
    expect(pace.paceStatus).toBe('on_track');
  });
});
