import { describe, expect, it } from 'vitest';

import {
  verifyMonthlyWithinCent,
  verifyRowCount,
  verifyTagTotalWithinCent,
  verifyTopNames,
} from './sheet-verify';

describe('sheet verification comparators', () => {
  it('requires exact row-count equality', () => {
    expect(verifyRowCount(16424, 16424)).toMatchObject({ ok: true, diff: 0 });
    expect(verifyRowCount(16424, 16423)).toMatchObject({ ok: false, diff: -1 });
  });

  it('accepts monthly totals within one cent of rounding', () => {
    const sheet = { incomeCents: 500000, expensesCents: 320050, netCents: 179950 };
    expect(verifyMonthlyWithinCent(sheet, { ...sheet })).toMatchObject({ ok: true });
    expect(
      verifyMonthlyWithinCent(sheet, { ...sheet, expensesCents: sheet.expensesCents + 1 }),
    ).toMatchObject({ ok: true });
    expect(
      verifyMonthlyWithinCent(sheet, { ...sheet, netCents: sheet.netCents + 2 }),
    ).toMatchObject({ ok: false });
  });

  it('compares top-category name sets regardless of order', () => {
    const sheet = ['Dining Out', 'Groceries', 'Shops'];
    expect(verifyTopNames(sheet, ['Groceries', 'Shops', 'Dining Out'])).toMatchObject({ ok: true });
    const mismatch = verifyTopNames(sheet, ['Groceries', 'Shops', 'Travel']);
    expect(mismatch.ok).toBe(false);
    expect(mismatch.missing).toEqual(['Dining Out']);
    expect(mismatch.extra).toEqual(['Travel']);
  });

  it('accepts tag totals within one cent', () => {
    expect(verifyTagTotalWithinCent(12345, 12345).ok).toBe(true);
    expect(verifyTagTotalWithinCent(12345, 12346).ok).toBe(true);
    expect(verifyTagTotalWithinCent(12345, 12347).ok).toBe(false);
  });
});
