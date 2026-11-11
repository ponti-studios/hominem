import { describe, expect, it } from 'vitest';

import { findLargestCompleteSpendingChange } from './monthly-breakdown-trends';

describe('findLargestCompleteSpendingChange', () => {
  it('ignores incomplete range endpoints and finds the largest adjacent completed-month change', () => {
    const data = [
      { date: '2026-05', income: 0, expenses: 9000, amount: -9000, count: 1, average: 9000 },
      { date: '2026-06', income: 0, expenses: 100, amount: -100, count: 1, average: 100 },
      { date: '2026-07', income: 0, expenses: 150, amount: -150, count: 1, average: 150 },
      { date: '2026-08', income: 0, expenses: 500, amount: -500, count: 1, average: 500 },
      { date: '2026-09', income: 0, expenses: 250, amount: -250, count: 1, average: 250 },
      { date: '2026-10', income: 0, expenses: 1000, amount: -1000, count: 1, average: 1000 },
      { date: '2026-11', income: 0, expenses: 5000, amount: -5000, count: 1, average: 5000 },
    ];

    const result = findLargestCompleteSpendingChange({
      data,
      dateFrom: new Date(2026, 4, 11),
      dateTo: new Date(2026, 10, 11),
      groupBy: 'month',
      now: new Date(2026, 10, 11),
    });

    expect(result).toEqual({
      previous: data[4],
      current: data[5],
      delta: 750,
    });
  });

  it('returns no comparison when the selected range contains fewer than two complete buckets', () => {
    const result = findLargestCompleteSpendingChange({
      data: [
        { date: '2026-11', income: 0, expenses: 5000, amount: -5000, count: 1, average: 5000 },
      ],
      dateFrom: new Date(2026, 10, 1),
      dateTo: new Date(2026, 10, 11),
      groupBy: 'month',
      now: new Date(2026, 10, 11),
    });

    expect(result).toBeNull();
  });
});
