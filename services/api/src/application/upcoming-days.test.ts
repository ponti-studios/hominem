import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { describeUpcomingDays } from './upcoming-days';

describe('describeUpcomingDays', () => {
  it('lists two weeks of local days with weekday names, starting today', () => {
    const line = describeUpcomingDays('2026-07-25T11:17:00-07:00', 'America/Los_Angeles');
    const days = line?.split(', ');
    expect(days).toHaveLength(14);
    expect(days?.[0]).toBe('Saturday 2026-07-25 (today)');
    expect(days?.[1]).toBe('Sunday 2026-07-26 (tomorrow)');
    expect(days?.[2]).toBe('Monday 2026-07-27');
    expect(days?.[13]).toBe('Friday 2026-08-07');
  });

  it('uses the user local date, not the UTC date', () => {
    expect(describeUpcomingDays('2026-07-26T02:00:00Z', 'America/Los_Angeles')).toMatch(
      /^Saturday 2026-07-25 \(today\)/,
    );
  });

  it('does not skip or repeat a day across a daylight-saving change', () => {
    const line = describeUpcomingDays('2026-03-07T23:30:00-08:00', 'America/Los_Angeles');
    expect(line?.split(', ').slice(0, 3)).toEqual([
      'Saturday 2026-03-07 (today)',
      'Sunday 2026-03-08 (tomorrow)',
      'Monday 2026-03-09',
    ]);
  });

  it('returns null without a usable time zone or reference date', () => {
    expect(describeUpcomingDays('2026-07-25T11:17:00-07:00', undefined)).toBeNull();
    expect(describeUpcomingDays('2026-07-25T11:17:00-07:00', 'Not/AZone')).toBeNull();
    expect(describeUpcomingDays('not a date', 'America/Los_Angeles')).toBeNull();
  });

  it('stays identical to the helper the Ori evals send to the model', () => {
    const code = (path: string) =>
      readFileSync(resolve(import.meta.dirname, path), 'utf8').replace(/\/\*\*[\s\S]*?\*\//, '');
    expect(code('../../../ori/evals/lib/upcoming-days.ts')).toBe(code('./upcoming-days.ts'));
  });
});
