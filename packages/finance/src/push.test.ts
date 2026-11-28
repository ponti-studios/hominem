import { describe, expect, it } from 'vitest';

import { buildDailyPushPayload } from './sheet-push';
import { sheetRow } from './test/rows';

describe('buildDailyPushPayload', () => {
  it('sends appended rows plus the trailing window, dropping exact duplicates', () => {
    const appended = [sheetRow('New Coffee', '2026-10-11'), sheetRow('New Bagel', '2026-10-11')];
    const recent = [
      sheetRow('Old Grocery', '2026-10-01'),
      sheetRow('Ancient History', '2026-09-01'),
      sheetRow('New Coffee', '2026-10-11'),
    ];
    const payload = buildDailyPushPayload({ appended, recent, asOf: '2026-10-11' });
    expect(payload.appendedCount).toBe(2);
    expect(payload.repushedCount).toBe(1);
    expect(payload.rows.map((r) => r.description).sort()).toEqual([
      'New Bagel',
      'New Coffee',
      'Old Grocery',
    ]);
  });

  it('re-pushes nothing outside the trailing window', () => {
    const payload = buildDailyPushPayload({
      appended: [],
      recent: [sheetRow('Ancient History', '2026-09-01')],
      asOf: '2026-10-11',
    });
    expect(payload.rows).toEqual([]);
    expect(payload.repushedCount).toBe(0);
  });

  it('keeps appended rows even when the recent window is empty', () => {
    const payload = buildDailyPushPayload({
      appended: [sheetRow('New Coffee', '2026-10-11')],
      recent: [],
      asOf: '2026-10-11',
    });
    expect(payload.rows).toHaveLength(1);
  });
});
