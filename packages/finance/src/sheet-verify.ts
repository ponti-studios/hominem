export interface SheetMoneyTotal {
  incomeCents: number;
  expensesCents: number;
  netCents: number;
}

/** §14.1: pending is excluded at source, so counts must match exactly. */
export function verifyRowCount(
  sheetRows: number,
  hominemRows: number,
): { ok: boolean; diff: number } {
  const diff = hominemRows - sheetRows;
  return { ok: diff === 0, diff };
}

/** §14.3: Monthly Actuals income/expense/net must match within rounding ($0.01). */
export function verifyMonthlyWithinCent(
  sheet: SheetMoneyTotal,
  hominem: SheetMoneyTotal,
): { ok: boolean; deltas: SheetMoneyTotal } {
  const deltas = {
    incomeCents: hominem.incomeCents - sheet.incomeCents,
    expensesCents: hominem.expensesCents - sheet.expensesCents,
    netCents: hominem.netCents - sheet.netCents,
  };
  const ok = [deltas.incomeCents, deltas.expensesCents, deltas.netCents].every(
    (delta) => Math.abs(delta) <= 1,
  );
  return { ok, deltas };
}

/** §14.4: top categories by count must agree as a set (order-insensitive). */
export function verifyTopNames(
  sheetTop: string[],
  hominemTop: string[],
): { ok: boolean; missing: string[]; extra: string[] } {
  const hominem = new Set(hominemTop);
  const sheet = new Set(sheetTop);
  const missing = sheetTop.filter((name) => !hominem.has(name));
  const extra = hominemTop.filter((name) => !sheet.has(name));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

/** §14.5: a tag total must match within rounding ($0.01). */
export function verifyTagTotalWithinCent(
  sheetTotalCents: number,
  hominemTotalCents: number,
): { ok: boolean; diff: number } {
  const diff = hominemTotalCents - sheetTotalCents;
  return { ok: Math.abs(diff) <= 1, diff };
}
