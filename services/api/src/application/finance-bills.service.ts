import { db } from '@hominem/db/core';
import { NotFoundError } from '@hominem/db/errors';
import {
  FinanceBillRepository,
  type FinanceBillBalanceEntryRecord,
  type FinanceBillBalanceWriteInput,
  type FinanceBillListFilters,
  type FinanceBillPatch,
  type FinanceBillRecord,
  type FinanceBillSupplyStatus,
  type FinanceBillWriteInput,
} from '@hominem/db/finance';

export type BillLastPaid = {
  transactionId: string;
  postedOn: string;
  amount: number;
  currencyCode: string;
};

export type BillPaygStatus = {
  latestBalanceCents: number;
  latestCheckedAt: string;
  supplyStatus: FinanceBillSupplyStatus;
  meterReadingKwh: number | null;
  dailyBurnCents: number | null;
  daysRemaining: number | null;
  estimatedRunOutDate: string | null;
  isStale: boolean;
  isLow: boolean;
};

export type BillDetail = FinanceBillRecord & {
  /** Computed at read time from the cadence and due day; never stored. */
  nextDueDate: string | null;
  /** The latest matched transaction; null when no transaction has been claimed. */
  lastPaid: BillLastPaid | null;
  /** Pay-as-you-go derivation; null on bills that are not top-up. */
  payg: BillPaygStatus | null;
};

export type BillDetailWithLog = BillDetail & {
  recentEntries: FinanceBillBalanceEntryRecord[];
};

const DAY_MS = 86_400_000;

function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function parseDay(value: string): { y: number; m: number; d: number } {
  const [y, m, d] = value.split('-').map(Number);
  return { y: y ?? 0, m: m ?? 0, d: d ?? 0 };
}

function toIso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getDate();
}

/** A short month clamps the due day to its last day: due on the 31st lands 28 February. */
function clampDay(y: number, m: number, day: number): string {
  return toIso(y, m, Math.min(day, daysInMonth(y, m)));
}

function addMonths(value: string, months: number): string {
  const { y, m, d } = parseDay(value);
  const total = m - 1 + months;
  const nextY = y + Math.floor(total / 12);
  const nextM = (((total % 12) + 12) % 12) + 1;
  return clampDay(nextY, nextM, d);
}

function addDays(value: string, days: number): string {
  const { y, m, d } = parseDay(value);
  const shifted = new Date(Date.UTC(y, m - 1, d) + Math.round(days) * DAY_MS);
  return toIso(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/**
 * The next date money is due. Monthly bills recur on `dueDay`; weekly, quarterly and annual
 * bills step from `anchorDate` (weekly in exact 7-day increments — its stored `dueDay` is not
 * part of the computation). Returns null when the bill has no recurrence to compute from.
 */
export function computeNextDueDate(
  input: {
    cadence: string | null;
    dueDay: number | null;
    dueDate: string | null;
    anchorDate: string | null;
  },
  now: Date = new Date(),
): string | null {
  const today = todayIso(now);
  const { cadence } = input;
  if (cadence === null) return null;
  if (cadence === 'one_off') return input.dueDate;
  if (cadence === 'monthly') {
    if (input.dueDay === null) return null;
    const { y, m } = parseDay(today);
    const candidate = clampDay(y, m, input.dueDay);
    if (candidate >= today) return candidate;
    return clampDay(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, input.dueDay);
  }
  if (input.anchorDate === null) return null;
  const stepMonths = cadence === 'weekly' ? 0 : cadence === 'quarterly' ? 3 : 12;
  let cursor = input.anchorDate;
  for (let step = 0; step < 1200; step += 1) {
    if (stepMonths === 0) {
      if (cursor >= today) return cursor;
      cursor = addDays(cursor, 7);
      continue;
    }
    const { y, m } = parseDay(cursor);
    const candidate = input.dueDay === null ? cursor : clampDay(y, m, input.dueDay);
    if (candidate >= today) return candidate;
    cursor = addMonths(cursor, stepMonths);
  }
  return null;
}

/** Every matched transaction, grouped to the latest payment per bill. */
async function readLastPaidByBill(ownerUserId: string): Promise<Map<string, BillLastPaid>> {
  const claims = await FinanceBillRepository.findClaimedTransactions(db, ownerUserId);
  const latest = new Map<string, BillLastPaid>();
  for (const claim of claims) {
    const existing = latest.get(claim.billId);
    if (!existing || claim.postedOn >= existing.postedOn) {
      latest.set(claim.billId, {
        transactionId: claim.transactionId,
        postedOn: claim.postedOn,
        amount: claim.amount,
        currencyCode: claim.currencyCode,
      });
    }
  }
  return latest;
}

/**
 * Pay-as-you-go derivation from the two latest observations: the daily burn is the balance
 * drop per day, and the run-out date projects the latest balance forward at that rate. A
 * rising balance (a top-up landed between checks) carries no run-out projection, and a single
 * observation carries no burn at all.
 */
function toPaygStatus(
  bill: FinanceBillRecord,
  entries: FinanceBillBalanceEntryRecord[],
  now: Date,
): BillPaygStatus | null {
  if (bill.amountModel !== 'top_up') return null;
  const latest = entries[0];
  if (!latest) return null;
  const previous = entries[1];
  let dailyBurnCents: number | null = null;
  let daysRemaining: number | null = null;
  let estimatedRunOutDate: string | null = null;
  if (previous) {
    const daysBetween = (Date.parse(latest.checkedAt) - Date.parse(previous.checkedAt)) / DAY_MS;
    if (daysBetween > 0) {
      const burn = (previous.balanceCents - latest.balanceCents) / daysBetween;
      if (burn > 0) {
        dailyBurnCents = burn;
        daysRemaining = latest.balanceCents <= 0 ? 0 : latest.balanceCents / burn;
        estimatedRunOutDate = addDays(latest.checkedAt.slice(0, 10), Math.floor(daysRemaining));
      }
    }
  }
  return {
    latestBalanceCents: latest.balanceCents,
    latestCheckedAt: latest.checkedAt,
    supplyStatus: latest.supplyStatus,
    meterReadingKwh: latest.meterReadingKwh,
    dailyBurnCents,
    daysRemaining,
    estimatedRunOutDate,
    isStale: now.getTime() - Date.parse(latest.checkedAt) > bill.staleAfterHours * 3_600_000,
    isLow: daysRemaining !== null && daysRemaining <= bill.paygWarnDays,
  };
}

async function toDetail(
  bill: FinanceBillRecord,
  lastPaid: BillLastPaid | null,
  entries: FinanceBillBalanceEntryRecord[],
  now: Date,
): Promise<BillDetail> {
  return {
    ...bill,
    nextDueDate: computeNextDueDate(bill, now),
    lastPaid,
    payg: toPaygStatus(bill, entries, now),
  };
}

/** Balance entries only matter for top-up bills; other bills skip the read. */
async function readPaygEntries(
  bill: FinanceBillRecord,
  ownerUserId: string,
  limit: number,
): Promise<FinanceBillBalanceEntryRecord[]> {
  if (bill.amountModel !== 'top_up') return [];
  return FinanceBillRepository.listBalanceEntries(db, ownerUserId, bill.id, limit);
}

export async function listBills(
  ownerUserId: string,
  filters?: FinanceBillListFilters,
  now: Date = new Date(),
): Promise<{ bills: BillDetail[]; count: number }> {
  const bills = await FinanceBillRepository.list(db, ownerUserId, filters);
  const lastPaidByBill = await readLastPaidByBill(ownerUserId);
  const details = await Promise.all(
    bills.map(async (bill) =>
      toDetail(
        bill,
        lastPaidByBill.get(bill.id) ?? null,
        await readPaygEntries(bill, ownerUserId, 2),
        now,
      ),
    ),
  );
  return { bills: details, count: details.length };
}

export async function getBill(
  ownerUserId: string,
  id: string,
  now: Date = new Date(),
): Promise<{ bill: BillDetailWithLog | null }> {
  const bill = await FinanceBillRepository.get(db, ownerUserId, id);
  if (!bill) return { bill: null };
  const lastPaidByBill = await readLastPaidByBill(ownerUserId);
  const recentEntries =
    bill.amountModel === 'top_up'
      ? await FinanceBillRepository.listBalanceEntries(db, ownerUserId, id, 5)
      : [];
  return {
    bill: {
      ...(await toDetail(
        bill,
        lastPaidByBill.get(bill.id) ?? null,
        recentEntries.slice(0, 2),
        now,
      )),
      recentEntries,
    },
  };
}

export async function createBill(
  ownerUserId: string,
  input: FinanceBillWriteInput,
  now: Date = new Date(),
): Promise<{ bill: BillDetail }> {
  const bill = await FinanceBillRepository.create(db, ownerUserId, input);
  return { bill: await toDetail(bill, null, [], now) };
}

export async function updateBill(
  ownerUserId: string,
  id: string,
  patch: FinanceBillPatch,
  now: Date = new Date(),
): Promise<{ bill: BillDetail | null }> {
  try {
    const bill = await FinanceBillRepository.update(db, ownerUserId, id, patch);
    if (!bill) return { bill: null };
    const lastPaidByBill = await readLastPaidByBill(ownerUserId);
    return {
      bill: await toDetail(
        bill,
        lastPaidByBill.get(bill.id) ?? null,
        await readPaygEntries(bill, ownerUserId, 2),
        now,
      ),
    };
  } catch (error) {
    if (error instanceof NotFoundError) return { bill: null };
    throw error;
  }
}

export async function getBillPreview(
  ownerUserId: string,
  id: string,
): Promise<{ id: string; name: string; balanceEntryCount: number } | null> {
  const bill = await FinanceBillRepository.get(db, ownerUserId, id);
  if (!bill) return null;
  const balanceEntryCount = await FinanceBillRepository.countBalanceEntries(db, ownerUserId, id);
  return { id: bill.id, name: bill.name, balanceEntryCount };
}

export async function deleteBill(
  ownerUserId: string,
  id: string,
  options?: { dryRun?: boolean },
): Promise<{
  removed: boolean;
  dryRun: boolean;
  preview: Array<{ id: string; name: string; balanceEntryCount: number }>;
}> {
  if (options?.dryRun) {
    const preview = await getBillPreview(ownerUserId, id);
    if (!preview) throw new NotFoundError('Finance bill not found');
    return { removed: false, dryRun: true, preview: [preview] };
  }
  const removed = await FinanceBillRepository.remove(db, ownerUserId, id);
  if (!removed) throw new NotFoundError('Finance bill not found');
  return { removed: true, dryRun: false, preview: [] };
}

export async function logBillBalance(
  ownerUserId: string,
  billId: string,
  entry: FinanceBillBalanceWriteInput,
  now: Date = new Date(),
): Promise<{ entry: FinanceBillBalanceEntryRecord | null; bill: BillDetailWithLog | null }> {
  try {
    const saved = await FinanceBillRepository.appendBalanceEntry(db, ownerUserId, billId, entry);
    const bill = await FinanceBillRepository.get(db, ownerUserId, billId);
    if (!bill) return { entry: null, bill: null };
    const recentEntries = await FinanceBillRepository.listBalanceEntries(
      db,
      ownerUserId,
      billId,
      5,
    );
    const lastPaidByBill = await readLastPaidByBill(ownerUserId);
    return {
      entry: saved,
      bill: {
        ...(await toDetail(
          bill,
          lastPaidByBill.get(bill.id) ?? null,
          recentEntries.slice(0, 2),
          now,
        )),
        recentEntries,
      },
    };
  } catch (error) {
    if (error instanceof NotFoundError) return { entry: null, bill: null };
    throw error;
  }
}
