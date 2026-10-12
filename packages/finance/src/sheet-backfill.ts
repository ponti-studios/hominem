import type { SheetImportSummary, SheetTransactionInput } from './sheet-import';

export const SHEET_BACKFILL_BATCH_SIZE = 1000;

export type SheetBatchCaller = (
  batch: SheetTransactionInput[],
  mode: 'append' | 'replace',
) => Promise<SheetImportSummary>;

export interface SheetBackfillTotals {
  received: number;
  upserted: number;
  created: number;
  updated: number;
  rejected: Array<{ index: number; reason: SheetImportSummary['rejected'][number]['reason'] }>;
}

export interface SheetBackfillResult {
  batches: number;
  totals: SheetBackfillTotals;
  failed: { batch: number; message: string } | null;
}

function emptyTotals(): SheetBackfillTotals {
  return { received: 0, upserted: 0, created: 0, updated: 0, rejected: [] };
}

/**
 * Push rows through the batch import tool 1000 at a time, in order. Fail fast
 * on the first throwing batch — completed batches stay committed and a re-run
 * resumes idempotently to created: 0. Per-row rejections never stop the run;
 * their indexes are re-based to the full row list.
 */
export async function runSheetBackfill(
  rows: SheetTransactionInput[],
  options: { mode: 'append' | 'replace' },
  caller: SheetBatchCaller,
): Promise<SheetBackfillResult> {
  const totals = emptyTotals();
  let batches = 0;
  for (let offset = 0; offset < rows.length; offset += SHEET_BACKFILL_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + SHEET_BACKFILL_BATCH_SIZE);
    let summary: SheetImportSummary;
    try {
      summary = await caller(batch, options.mode);
    } catch (error) {
      return {
        batches,
        totals,
        failed: {
          batch: batches,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
    batches += 1;
    totals.received += summary.received;
    totals.upserted += summary.upserted;
    totals.created += summary.created;
    totals.updated += summary.updated;
    for (const rejection of summary.rejected) {
      totals.rejected.push({ index: rejection.index + offset, reason: rejection.reason });
    }
  }
  return { batches, totals, failed: null };
}
