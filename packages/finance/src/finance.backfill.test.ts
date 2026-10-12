import { describe, expect, it, vi } from 'vitest';

import { runSheetBackfill } from './sheet-backfill';
import type { SheetTransactionInput } from './sheet-import';

function row(description: string, postedOn = '2026-10-01'): SheetTransactionInput {
  return {
    postedOn,
    account: 'Sheet Checking',
    description,
    amountCents: -100,
    currencyCode: 'USD',
  };
}

describe('runSheetBackfill', () => {
  it('chunks at 1000 rows and aggregates summaries with re-indexed rejections', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => row(`Row ${i}`));
    const caller = vi.fn(async (batch: SheetTransactionInput[], _mode: 'append' | 'replace') => ({
      received: batch.length,
      upserted: batch.length,
      created: batch.length,
      updated: 0,
      rejected: [{ index: 0, reason: 'unknown_account' as const }],
      accountsAutoProvisioned: [],
    }));
    const result = await runSheetBackfill(rows, { mode: 'append' }, caller);
    expect(caller).toHaveBeenCalledTimes(3);
    expect(caller.mock.calls.map((call) => call[0].length)).toEqual([1000, 1000, 500]);
    expect(result.batches).toBe(3);
    expect(result.totals.created).toBe(2500);
    expect(result.totals.rejected.map((r) => r.index)).toEqual([0, 1000, 2000]);
    expect(result.failed).toBeNull();
  });

  it('fails fast on the first throwing batch and keeps completed work', async () => {
    const rows = Array.from({ length: 3000 }, (_, i) => row(`Row ${i}`));
    const caller = vi.fn(async (batch: SheetTransactionInput[]) => {
      if ((batch[0]?.description ?? '') === 'Row 1000') throw new Error('transport down');
      return {
        received: batch.length,
        upserted: batch.length,
        created: batch.length,
        updated: 0,
        rejected: [],
        accountsAutoProvisioned: [],
      };
    });
    const result = await runSheetBackfill(rows, { mode: 'append' }, caller);
    expect(caller).toHaveBeenCalledTimes(2);
    expect(result.batches).toBe(1);
    expect(result.totals.created).toBe(1000);
    expect(result.failed).toMatchObject({ batch: 1, message: 'transport down' });
  });

  it('resume by re-run yields created: 0', async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => row(`Row ${i}`));
    let pass = 0;
    const caller = vi.fn(async (batch: SheetTransactionInput[]) => {
      pass++;
      const created = pass <= 2 ? batch.length : 0;
      return {
        received: batch.length,
        upserted: batch.length,
        created,
        updated: 0,
        rejected: [],
        accountsAutoProvisioned: [],
      };
    });
    const first = await runSheetBackfill(rows, { mode: 'append' }, caller);
    expect(first.totals.created).toBe(1500);
    const second = await runSheetBackfill(rows, { mode: 'append' }, caller);
    expect(second.totals.created).toBe(0);
    expect(second.failed).toBeNull();
  });
});
