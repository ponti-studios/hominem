import type { SheetTransactionInput } from './sheet-import';

export interface DailyPushInput {
  /** Rows appended by today's sheet sync (held in memory as new_rows). */
  appended: SheetTransactionInput[];
  /** Recently modified rows for the edit flow (category corrections, notes). */
  recent: SheetTransactionInput[];
  /** Re-push window in days. Sheet edits flow on the next run; idempotency is free. */
  trailingDays?: number;
  /** Window end, ISO date. Defaults to today (UTC). */
  asOf?: string;
}

export interface DailyPushPayload {
  rows: SheetTransactionInput[];
  appendedCount: number;
  repushedCount: number;
}

function daysBefore(asOf: string, days: number): string {
  const date = new Date(`${asOf}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * Build the daily push body: today's appended rows plus a trailing window of
 * recently modified rows so sheet-side edits flow downstream. Exact
 * duplicates collapse. Push failures must log loudly on the VM but never
 * block the sheet write — the sheet is the source of truth and re-pushes.
 */
export function buildDailyPushPayload(input: DailyPushInput): DailyPushPayload {
  const trailingDays = input.trailingDays ?? 14;
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const cutoff = daysBefore(asOf, trailingDays);
  const appendedKeys = new Set(input.appended.map((row) => JSON.stringify(row)));
  const seen = new Set<string>();
  const rows: SheetTransactionInput[] = [];
  for (const row of [...input.recent, ...input.appended]) {
    if (row.postedOn < cutoff && !appendedKeys.has(JSON.stringify(row))) continue;
    const key = JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  const repushedCount = rows.filter((row) => !appendedKeys.has(JSON.stringify(row))).length;
  return { rows, appendedCount: input.appended.length, repushedCount };
}
