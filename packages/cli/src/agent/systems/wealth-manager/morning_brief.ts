#!/usr/bin/env node
/**
 * Layer 2 — the Morning Brief (WYA-228), ported 2026-11-22 from
 * archive systems-live/wealth-manager/morning_brief.py. Exception-led
 * daily brief, runs AFTER the daily sync and Layer 1. Reads Hominem
 * only — the system of record; the data rule (2026-11-06) is carried
 * verbatim: Plaid is INGEST ONLY and is never a source for analysis,
 * so this routine reads no feed data at all. Its only writes are its
 * bills snapshot and its own JSON output. Prints one object:
 *
 *   {"ok": true, "date": "...", "sections": {...}, "silent": false,
 *    "run_id": n}
 *
 * Sections with nothing to report are omitted. `silent` is true when
 * there are no anomaly flags, no bill flags, no over-threshold
 * (>£50/$50) items yesterday, and no pacing entries.
 *
 * Sections:
 *   1. money_in_out — yesterday's net per currency (GBP and USD are
 *      never combined). Transfers and Adjustment are excluded from
 *      the in/out math (money plumbing and balance plugs, not
 *      spending); Income counts as money in. Items over £50/$50 named.
 *   2. budget_pacing — anchored to the month containing YESTERDAY:
 *      expected = budget * day_of_month / days_in_month, projected =
 *      MTD / day_of_month * days_in_month. An entry is emitted only
 *      when projected month-end exceeds budget or MTD is >20% ahead of
 *      expected-by-day-of-month. MTD comes from
 *      finance_spending_by_category for the month window, so it
 *      reconciles to Hominem's category totals by construction — no
 *      second, row-summed MTD figure anywhere. WYA-271 (2026-11-02):
 *      tag budgets are composition only and never breach on their
 *      own; the category budget is the only breach line.
 *   3. anomalies — yesterday's rows vs the prior 90 days: amount
 *      anomaly (median/MAD robust z-score; when MAD == 0 only the 2x
 *      median rule applies), first-seen merchant over the threshold,
 *      FX charges named from the row's own text, duplicate-looking
 *      charges. Merchant history capped at 8 calls per run.
 *   4. bills — finance_bill_list snapshotted to
 *      morning_brief_bills.json and diffed against the previous
 *      snapshot: new bill, gone inactive, expected-amount change, and
 *      overdue (the due date that just passed has no matched payment,
 *      merchant-match bills only, never for a due date before the
 *      bill existed, 3-day grace). Bills due within 3 days ride along
 *      as due_soon (not a flag). First run writes the baseline.
 *
 * Deliberate deltas from the archive (recorded 2026-11-22):
 *   - Budgets are Hominem data now, not taxonomy.json: category and
 *     tag budget rows come from finance_budget_list (storedBudgets),
 *     every amount denominated in the server's primary currency.
 *     Under the 2026-11-22 ruling nothing personal is hardcoded here;
 *     when the primary currency is unset the server's own warning is
 *     carried in diagnostics and pacing is skipped — never guessed.
 *   - The server's breaches array (any cadence) flags alongside the
 *     archived month pacing, which stays client-side for MONTHLY
 *     budgets only — the archived math is month math; weekly /
 *     quarterly / annual budgets surface through breaches alone.
 *   - Tag composition (WYA-271) stays client-side with the disjoint
 *     priority rule (Coffee, then Dining Out, then Groceries — a row
 *     counts once). The server's own tagBudgets bucket each tag
 *     independently, so a row carrying two tags would count twice
 *     there; the ticket's rule wins here. Only tag AMOUNTS moved to
 *     Hominem (storedBudgets).
 *   - Yesterday's rows come from finance_transaction_search (the
 *     archived tool call was equivalent); a day with more matches
 *     than one page is surfaced as yesterday_truncated in
 *     diagnostics — the archive capped at 50 silently, and a one-day
 *     window cannot be split.
 *   - The bills snapshot moved from script-local (hatch path) to
 *     $HOMINEM_AGENT_WEALTH_DIR — machine-local state, law 4. The archived
 *     CLI flags --date / --no-write-snapshot / --bills-only became
 *     env pins: WEALTH_SYNC_TODAY / WEALTH_BRIEF_NO_WRITE_SNAPSHOT /
 *     WEALTH_BRIEF_BILLS_ONLY.
 *   - The ponti_log subprocess and its API-call budget became the
 *     HominemMcp HTTP client — every call lands an events row (law
 *     1), the count still reported in diagnostics as hominem_calls.
 *
 * Env (law 4): HOMINEM_MCP_URL + HOMINEM_MCP_TOKEN (the backbone —
 * missing fails the run by name), HOMINEM_AGENT_WEALTH_DIR (default
 * ~/.hominem/wealth), WEALTH_SYNC_TODAY (pin the run date).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { finishRun, logRun } from '../../log/agent_log.ts';
import { applyEnvDefaults, envOr } from './env.ts';
import {
  HominemMcp,
  type BudgetStoredRow,
  type HominemBillRow,
  type HominemSearchRow,
} from './hominem.ts';
import { isoMinusDays, isoPlusDays, round2 } from './types.ts';

const LARGE_THRESHOLD = 50.0;
const EXCLUDED_CATEGORIES = new Set(['Transfers', 'Adjustment']);
const HISTORY_DAYS = 90;
const MAX_HISTORY_MERCHANTS = 8;
const FX_TOKENS = [
  'foreign transaction',
  'foreign-transaction',
  'non-sterling',
  'non sterling',
  'currency conversion',
  'fx fee',
  'fx charge',
  'international transaction',
  'overseas transaction',
];
/** WYA-271 priority rule: a row counts in the first tag it carries. */
const TAG_PRIORITY = ['Coffee', 'Dining Out', 'Groceries'];
const BILL_CADENCE_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, annual: 12 };
const DUE_SOON_DAYS = 3;
const OVERDUE_GRACE_DAYS = 3;

interface BriefFlag {
  type: string;
  merchant?: string;
  amount?: number;
  currency?: string;
  count?: number;
  detail: string;
}

/** A yesterday item over the £50/$50 threshold, named for the brief. */
interface LargeItem {
  merchant: string;
  description: string | null;
  amount: number;
  currency: string;
  category: string | null;
  postedOn: string;
}

/**
 * Bill diff flags keep the archived envelope keys verbatim (`bill` +
 * `provider`, `previous_amount`, `due_date`/`last_paid_on`) — the
 * brief's consumers read those names.
 */
interface BillDiffFlag {
  type: string;
  bill: string;
  provider?: string | null;
  previous_amount?: number;
  amount?: number;
  currency?: string;
  due_date?: string;
  last_paid_on?: string | null;
  detail: string;
}

interface BillRecord {
  id: string;
  name: string;
  provider: string | null;
  kind: string;
  amount_model: string;
  expected_amount: number | null;
  currency: string;
  cadence: string | null;
  due_day: number | null;
  status: string;
  type: string;
  next_due: string | null;
  last_paid_on: string | null;
  match_configured: boolean;
  created_on: string | null;
}

function todayIso(): string {
  return process.env.WEALTH_SYNC_TODAY ?? new Date().toLocaleDateString('en-CA');
}

function wealthDir(): string {
  return envOr('HOMINEM_AGENT_WEALTH_DIR', join(homedir(), '.hominem', 'wealth'));
}

function merchantKey(t: HominemSearchRow): string {
  return (t.merchantName ?? t.description ?? '').trim().toLowerCase();
}

function displayName(t: HominemSearchRow): string {
  return t.merchantName ?? t.description ?? '(unknown)';
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function daysInMonth(iso: string): number {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// ---------------------------------------------------------- money in/out

function sectionMoneyInOut(yesterdayRows: HominemSearchRow[]): {
  section: Record<string, unknown> | null;
  largeItems: LargeItem[];
} {
  const perCurrency: Record<string, { in: number; out: number; net: number; count: number }> = {};
  const largeItems: LargeItem[] = [];
  for (const t of yesterdayRows) {
    const cat = t.categoryName;
    if ((cat && EXCLUDED_CATEGORIES.has(cat)) || t.excluded) continue;
    const cur = t.currencyCode || 'UNKNOWN';
    const amt = t.amount;
    const bucket = (perCurrency[cur] ??= { in: 0, out: 0, net: 0, count: 0 });
    // Income counts as in; otherwise the amount's sign decides.
    if (amt > 0 || cat === 'Income') bucket.in += Math.abs(amt);
    else if (amt < 0) bucket.out += Math.abs(amt);
    bucket.net += amt;
    bucket.count += 1;
    if (Math.abs(amt) > LARGE_THRESHOLD) {
      largeItems.push({
        merchant: displayName(t),
        description: t.description,
        amount: amt,
        currency: cur,
        category: cat,
        postedOn: t.postedOn,
      });
    }
  }
  for (const bucket of Object.values(perCurrency)) {
    bucket.in = round2(bucket.in);
    bucket.out = round2(bucket.out);
    bucket.net = round2(bucket.net);
  }
  if (Object.keys(perCurrency).length === 0) return { section: null, largeItems };
  return { section: { per_currency: perCurrency, large_items: largeItems }, largeItems };
}

// ---------------------------------------------------------- budget pacing

interface PacingRow {
  category: string;
  currency: string;
  budget: number;
  month_to_date: number;
  // Month math only exists for monthly budgets; a breach-only entry
  // (weekly/quarterly/annual cadence) carries no pacing figures.
  expected_by_now?: number;
  projected_month_end?: number;
  month?: string;
  day_of_month?: number;
  days_in_month?: number;
  reason?: string;
  over_budget?: boolean;
  components?: Record<string, { budget: number; month_to_date: number; over_tag_budget: boolean }>;
  mix_note?: string;
}

/**
 * WYA-271 composition: disjoint buckets by the ticket's priority rule —
 * a row belongs to the first priority tag it carries, else it is not
 * bucketed. Spend rows in the budget currency only; composition never
 * produces a breach.
 */
async function tagComposition(
  hominem: HominemMcp,
  categoryName: string,
  tagBudgets: BudgetStoredRow[],
  monthStart: string,
  yesterday: string,
  currency: string,
): Promise<PacingRow['components']> {
  const buckets: Record<string, number> = {};
  for (const tag of tagBudgets) {
    if (tag.tagName) buckets[tag.tagName] = 0;
  }
  let offset = 0;
  for (let page = 0; page < 10; page++) {
    // at most 500 rows in the pacing month (page = 50 max)
    const res = await hominem.searchTransactions({
      categoryName,
      from: monthStart,
      to: yesterday,
      limit: 50,
      offset,
    });
    for (const t of res.transactions) {
      if (t.excluded || t.currencyCode !== currency) continue;
      if (t.amount >= 0) continue;
      for (const name of TAG_PRIORITY) {
        if (name in buckets && t.tags.includes(name)) {
          buckets[name] += Math.abs(t.amount);
          break;
        }
      }
    }
    if (res.transactions.length < 50) break;
    offset += 50;
  }
  return Object.fromEntries(
    Object.entries(buckets).map(([name, total]) => {
      const budget = tagBudgets.find((t) => t.tagName === name)!;
      const mtd = round2(total);
      return [
        name,
        {
          budget: budget.amountCents / 100,
          month_to_date: mtd,
          over_tag_budget: mtd > budget.amountCents / 100,
        },
      ];
    }),
  );
}

async function sectionBudgetPacing(
  hominem: HominemMcp,
  yesterday: string,
  diagnostics: Record<string, unknown>,
): Promise<PacingRow[]> {
  const monthStart = `${yesterday.slice(0, 7)}-01`;
  const dim = daysInMonth(yesterday);
  const dayOfMonth = Number(yesterday.slice(8, 10));
  const budgets = await hominem.budgetList();
  if (!budgets.primaryCurrency) {
    // The server's own warning, carried verbatim — never guessed.
    diagnostics.pacing_skipped =
      budgets.warning ?? 'hominem reports no primary currency; pacing needs one';
    return [];
  }
  const cur = budgets.primaryCurrency;
  const report = await hominem.spendingByCategory({ from: monthStart, to: yesterday, limit: 50 });
  const spent = new Map(
    report.categories.map((c) => [`${c.categoryName}|${c.currencyCode}`, c.spent]),
  );
  const categoryBudgets = budgets.storedBudgets.filter((b) => b.tagId === null);
  const tagBudgetsByCat = new Map<string, BudgetStoredRow[]>();
  for (const b of budgets.storedBudgets) {
    if (b.tagId === null) continue;
    const arr = tagBudgetsByCat.get(b.categoryId) ?? [];
    arr.push(b);
    tagBudgetsByCat.set(b.categoryId, arr);
  }
  const breachedCats = new Set(budgets.breaches.map((b) => b.categoryName));
  const entries: PacingRow[] = [];
  const detail: Record<string, PacingRow> = {};
  for (const b of categoryBudgets) {
    if (b.cadence !== 'monthly') continue; // the archived math is month math
    const budget = b.amountCents / 100;
    const mtd = spent.get(`${b.categoryName}|${cur}`) ?? 0;
    const expected = (budget * dayOfMonth) / dim;
    const projected = dayOfMonth ? (mtd / dayOfMonth) * dim : 0;
    const row: PacingRow = {
      category: b.categoryName,
      currency: cur,
      budget,
      month_to_date: round2(mtd),
      expected_by_now: round2(expected),
      projected_month_end: round2(projected),
      month: yesterday.slice(0, 7),
      day_of_month: dayOfMonth,
      days_in_month: dim,
    };
    const tagBudgets = tagBudgetsByCat.get(b.categoryId) ?? [];
    if (tagBudgets.length > 0) {
      row.components = await tagComposition(
        hominem,
        b.categoryName,
        tagBudgets,
        monthStart,
        yesterday,
        cur,
      );
      const over = Object.entries(row.components ?? {})
        .filter(([, c]) => c.over_tag_budget)
        .map(([name]) => name);
      if (over.length > 0 && projected <= budget) {
        row.mix_note =
          `mix is lopsided: ${over.join(', ')} over their tag budgets — composition ` +
          `only, not a breach (${b.categoryName} is within budget)`;
      }
    }
    if (breachedCats.has(b.categoryName)) row.over_budget = true;
    if (projected > budget) row.reason = 'projected month-end exceeds budget';
    else if (mtd > expected * 1.2) row.reason = 'pace >20% ahead of expected';
    detail[b.categoryName] = row;
    if (row.reason) entries.push(row);
  }
  // The server's breach list is the complete exception list for every
  // cadence — any breach without a pacing entry still gets one.
  for (const breach of budgets.breaches) {
    if (entries.some((e) => e.category === breach.categoryName)) continue;
    const stored = categoryBudgets.find((b) => b.categoryName === breach.categoryName);
    entries.push({
      category: breach.categoryName,
      currency: cur,
      budget: stored ? stored.amountCents / 100 : 0,
      month_to_date: round2(spent.get(`${breach.categoryName}|${cur}`) ?? 0),
      reason: `over budget — hominem reports over by ${round2(breach.overByCents / 100).toFixed(2)}`,
      over_budget: true,
    });
  }
  diagnostics.pacing_all = detail;
  return entries;
}

// ---------------------------------------------------------------- anomalies

async function sectionAnomalies(
  hominem: HominemMcp,
  yesterdayRows: HominemSearchRow[],
  yesterday: string,
  sourceErrors: Record<string, string>,
): Promise<BriefFlag[]> {
  const flags: BriefFlag[] = [];
  const rows = yesterdayRows.filter((t) => !t.excluded);
  // (d) duplicate-looking charges — yesterday only, no extra calls.
  const groups = new Map<string, HominemSearchRow[]>();
  for (const t of rows) {
    const key = `${merchantKey(t)}|${t.amount}|${t.currencyCode}`;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }
  for (const [key, grp] of [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const mkey = key.split('|')[0];
    if (grp.length >= 2 && mkey) {
      flags.push({
        type: 'duplicate_charge',
        merchant: displayName(grp[0]),
        amount: grp[0].amount,
        currency: grp[0].currencyCode,
        count: grp.length,
        detail: `${grp.length} identical charges on ${yesterday}`,
      });
    }
  }
  // (c) FX charges — yesterday only, named from the row's own text.
  for (const t of rows) {
    const text =
      `${t.description ?? ''} ${t.merchantName ?? ''} ${t.categoryName ?? ''}`.toLowerCase();
    const cur = t.currencyCode;
    if (FX_TOKENS.some((tok) => text.includes(tok))) {
      flags.push({
        type: 'fx_charge',
        merchant: displayName(t),
        amount: t.amount,
        currency: cur,
        detail: `row text indicates an FX/foreign charge: "${t.description}"`,
      });
    } else if (cur && cur !== 'GBP' && cur !== 'USD') {
      flags.push({
        type: 'fx_charge',
        merchant: displayName(t),
        amount: t.amount,
        currency: cur,
        detail: `charge in non-GBP/USD currency ${cur}: "${t.description}"`,
      });
    }
  }
  // (a) + (b) — per-merchant history, capped to protect the call cap.
  const merchants: string[] = [];
  for (const t of rows) {
    const mk = merchantKey(t);
    if (mk && !merchants.includes(mk)) merchants.push(mk);
  }
  const histFrom = isoMinusDays(yesterday, HISTORY_DAYS);
  const histTo = isoMinusDays(yesterday, 1);
  for (const mk of merchants.slice(0, MAX_HISTORY_MERCHANTS)) {
    const todays = rows.filter((t) => merchantKey(t) === mk);
    try {
      const res = await hominem.searchTransactions({
        query: displayName(todays[0]),
        from: histFrom,
        to: histTo,
        limit: 50,
      });
      // The search is fuzzy; the history is the exact-merchant subset.
      const history = res.transactions.filter((t) => merchantKey(t) === mk && !t.excluded);
      const priorAbs = history.map((t) => Math.abs(t.amount));
      for (const t of todays) {
        const amt = Math.abs(t.amount);
        if (priorAbs.length === 0 && amt > LARGE_THRESHOLD) {
          flags.push({
            type: 'first_seen_merchant',
            merchant: displayName(t),
            amount: t.amount,
            currency: t.currencyCode,
            detail: `no occurrence in prior ${HISTORY_DAYS} days and over the £50/$50 threshold`,
          });
        } else if (priorAbs.length >= 3) {
          const med = median(priorAbs);
          const mad = median(priorAbs.map((x) => Math.abs(x - med)));
          const overDouble = amt > 2 * med;
          const overMad = mad > 0 && amt > med + 3 * 1.4826 * mad;
          if (overDouble || overMad) {
            flags.push({
              type: 'amount_anomaly',
              merchant: displayName(t),
              amount: t.amount,
              currency: t.currencyCode,
              detail:
                `prior ${priorAbs.length} charges: median ${med.toFixed(2)}, MAD ${mad.toFixed(2)}; ` +
                `today ${amt.toFixed(2)} breaches ${overDouble ? '2x median' : 'median+3*MAD'}`,
            });
          }
        }
      }
    } catch (err) {
      sourceErrors[`history:${mk}`] = String((err as Error).message).slice(0, 200);
    }
  }
  return flags;
}

// -------------------------------------------------------------------- bills

function billRecord(b: HominemBillRow): BillRecord {
  return {
    id: b.id,
    name: b.name,
    provider: b.providerName,
    kind: b.kind,
    amount_model: b.amountModel,
    expected_amount: b.expectedAmountCents !== null ? b.expectedAmountCents / 100 : null,
    currency: b.currencyCode,
    cadence: b.cadence,
    due_day: b.dueDay,
    status: b.status,
    type: b.type,
    next_due: b.nextDueDate,
    last_paid_on: b.lastPaid?.postedOn ?? null,
    match_configured: (b.merchantMatch ?? []).length > 0,
    created_on: (b.createdAt ?? '').slice(0, 10) || null,
  };
}

/** Step one cadence back from a due date, or null when unsteppable. */
function stepBack(dueIso: string, cadence: string | null): string | null {
  if (cadence === 'weekly') return isoMinusDays(dueIso, 7);
  const step = BILL_CADENCE_MONTHS[cadence ?? 'monthly'];
  if (step === undefined) return null;
  const y = Number(dueIso.slice(0, 4));
  const m = Number(dueIso.slice(5, 7));
  const d = Number(dueIso.slice(8, 10));
  const idx = y * 12 + m - 1 - step;
  const ny = Math.floor(idx / 12);
  let nm = idx % 12;
  nm += 1;
  const dim = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`;
}

function diffBills(prev: BillRecord[], curr: BillRecord[], runDate: string): BillDiffFlag[] {
  const flags: BillDiffFlag[] = [];
  const prevById = new Map(prev.filter((b) => b.id).map((b) => [b.id, b]));
  const currById = new Map(curr.filter((b) => b.id).map((b) => [b.id, b]));
  for (const [bid, b] of [...currById.entries()].sort(([a], [c]) => (a < c ? -1 : 1))) {
    if (!prevById.has(bid)) {
      flags.push({
        type: 'new_bill',
        bill: b.name,
        provider: b.provider,
        detail: 'bill not present in previous snapshot',
      });
    }
  }
  for (const [bid, b] of [...prevById.entries()].sort(([a], [c]) => (a < c ? -1 : 1))) {
    const now = currById.get(bid);
    if (b.status === 'active' && (now === undefined || now.status !== 'active')) {
      flags.push({
        type: 'bill_inactive',
        bill: b.name,
        provider: b.provider,
        detail: `was active in previous snapshot, now ${now === undefined ? 'missing' : now.status}`,
      });
      continue;
    }
    if (now === undefined) continue;
    const old = b.expected_amount;
    const neu = now.expected_amount;
    if (old !== null && neu !== null && old !== neu) {
      flags.push({
        type: 'bill_amount_change',
        bill: now.name,
        provider: now.provider,
        previous_amount: old,
        amount: neu,
        currency: now.currency,
        detail: `expected amount changed ${old.toFixed(2)} -> ${neu.toFixed(2)}`,
      });
    }
  }
  // Overdue: the due date that just passed has no matched payment.
  // Merchant-match bills only (otherwise Hominem cannot derive
  // last-paid at all), and never for a due date before registration.
  for (const [, b] of [...currById.entries()].sort(([a], [c]) => (a < c ? -1 : 1))) {
    if (b.status !== 'active' || !b.match_configured) continue;
    if (!b.next_due || !b.cadence) continue;
    if (b.cadence === 'one_off') continue;
    const lastDue = stepBack(b.next_due, b.cadence);
    if (lastDue === null || lastDue >= runDate) continue;
    if (b.created_on && lastDue < b.created_on) continue;
    const graceStart = isoMinusDays(lastDue, OVERDUE_GRACE_DAYS);
    if (b.last_paid_on === null || b.last_paid_on < graceStart) {
      flags.push({
        type: 'bill_overdue',
        bill: b.name,
        provider: b.provider,
        due_date: lastDue,
        last_paid_on: b.last_paid_on,
        detail: `due ${lastDue}; no matched payment on or after ${graceStart}`,
      });
    }
  }
  return flags;
}

async function sectionBills(
  hominem: HominemMcp,
  snapshotPath: string,
  writeSnapshot: boolean,
  runDate: string,
  sourceErrors: Record<string, string>,
): Promise<{ section: Record<string, unknown>; flags: BillDiffFlag[] }> {
  const res = await hominem.billList();
  const curr = res.bills
    .filter((b) => b.type !== 'cancelled' && !b.isDismissed)
    .map((b) => billRecord(b));
  let prev: BillRecord[] | null = null;
  if (existsSync(snapshotPath)) {
    try {
      prev =
        (JSON.parse(readFileSync(snapshotPath, 'utf8')) as { bills?: BillRecord[] }).bills ?? [];
    } catch (err) {
      sourceErrors.snapshot_read = String((err as Error).message).slice(0, 200);
    }
  }
  if (writeSnapshot) {
    writeFileSync(snapshotPath, JSON.stringify({ bills: curr }, null, 1) + '\n');
  }
  const activeBills = curr.filter((b) => b.status === 'active');
  const dueSoon = activeBills
    .filter(
      (b) =>
        b.next_due && runDate <= b.next_due && b.next_due <= isoPlusDays(runDate, DUE_SOON_DAYS),
    )
    .map((b) => ({
      bill: b.name,
      provider: b.provider,
      date: b.next_due,
      amount: b.expected_amount,
      currency: b.currency,
    }));
  if (prev === null) {
    return {
      section: { baseline_created: true, active_bills: activeBills.length, due_soon: dueSoon },
      flags: [],
    };
  }
  return {
    section: { active_bills: activeBills.length, previous_bills: prev.length, due_soon: dueSoon },
    flags: diffBills(prev, curr, runDate),
  };
}

// -------------------------------------------------------------------- main

interface BriefEnvelope {
  ok: boolean;
  date: string;
  sections: Record<string, unknown>;
  silent: boolean;
  run_id: number;
}

async function runBrief(dbPath: string | undefined, runId: number): Promise<BriefEnvelope> {
  const runDate = todayIso();
  const yesterday = isoMinusDays(runDate, 1);
  const sections: Record<string, unknown> = {};
  const diagnostics: Record<string, unknown> = { yesterday };
  const sourceErrors: Record<string, string> = {};
  let largeItems: LargeItem[] = [];
  let pacingEntries: PacingRow[] = [];
  let anomalyFlags: BriefFlag[] = [];
  let billFlags: BillDiffFlag[] = [];
  const hominem = new HominemMcp({ dbPath });
  let hominemCalls = 0;
  const origCall = hominem.call.bind(hominem);
  hominem.call = ((tool: string, args: Record<string, unknown>) => {
    hominemCalls += 1;
    return origCall(tool, args);
  }) as typeof hominem.call;

  if (!process.env.WEALTH_BRIEF_BILLS_ONLY) {
    // Yesterday's rows: one windowed search; a day with more matches
    // than one page is surfaced, never silently capped.
    let yesterdayRows: HominemSearchRow[] = [];
    try {
      const res = await hominem.searchTransactions({ from: yesterday, to: yesterday, limit: 50 });
      yesterdayRows = res.transactions;
      if (res.filteredCount > res.transactions.length) {
        diagnostics.yesterday_truncated = res.filteredCount;
      }
    } catch (err) {
      sourceErrors.yesterday_rows = String((err as Error).message).slice(0, 200);
    }
    try {
      const { section, largeItems: items } = sectionMoneyInOut(yesterdayRows);
      largeItems = items;
      if (section) sections.money_in_out = section;
    } catch (err) {
      sourceErrors.money_in_out = String((err as Error).message).slice(0, 200);
    }
    try {
      pacingEntries = await sectionBudgetPacing(hominem, yesterday, diagnostics);
      if (pacingEntries.length > 0) sections.budget_pacing = pacingEntries;
    } catch (err) {
      sourceErrors.budget_pacing = String((err as Error).message).slice(0, 200);
    }
    try {
      anomalyFlags = await sectionAnomalies(hominem, yesterdayRows, yesterday, sourceErrors);
      if (anomalyFlags.length > 0) sections.anomalies = anomalyFlags;
    } catch (err) {
      sourceErrors.anomalies = String((err as Error).message).slice(0, 200);
    }
  }

  try {
    const { section, flags } = await sectionBills(
      hominem,
      join(wealthDir(), 'morning_brief_bills.json'),
      !process.env.WEALTH_BRIEF_NO_WRITE_SNAPSHOT,
      runDate,
      sourceErrors,
    );
    billFlags = flags;
    sections.bills = flags.length > 0 ? { ...section, flags } : section;
  } catch (err) {
    sourceErrors.bills = String((err as Error).message).slice(0, 200);
  }

  diagnostics.hominem_calls = hominemCalls;
  if (Object.keys(sourceErrors).length > 0) diagnostics.source_errors = sourceErrors;
  sections.diagnostics = diagnostics;

  const silent =
    anomalyFlags.length === 0 &&
    billFlags.length === 0 &&
    largeItems.length === 0 &&
    pacingEntries.length === 0;
  // The archived contract: a run with source errors still counts as ok
  // when it produced a money section or a bills section — partial data
  // beats no data, and the errors ride along in diagnostics.
  const ok =
    Object.keys(sourceErrors).length === 0 ||
    sections.money_in_out !== undefined ||
    sections.bills !== undefined;
  return { ok, date: runDate, sections, silent, run_id: runId };
}

export async function main(): Promise<number> {
  applyEnvDefaults();
  const dbPath = process.env.HOMINEM_AGENT_DB; // undefined = the default audit db
  const runId = logRun('wealth-brief', {
    status: 'invoked',
    context: { today: todayIso(), dir: wealthDir() },
    path: dbPath,
  });
  try {
    const envelope = await runBrief(dbPath, runId);
    finishRun(runId, {
      status: 'ok',
      exitCode: 0,
      message: envelope.silent
        ? 'silent day'
        : `${envelope.sections.anomalies !== undefined ? (envelope.sections.anomalies as BriefFlag[]).length : 0} anomalies, ` +
          `${envelope.sections.budget_pacing !== undefined ? (envelope.sections.budget_pacing as PacingRow[]).length : 0} pacing, ` +
          `${envelope.sections.bills !== undefined ? ((envelope.sections.bills as { flags?: BillDiffFlag[] }).flags ?? []).length : 0} bill flags`,
      path: dbPath,
    });
    process.stdout.write(JSON.stringify(envelope, null, 1) + '\n');
    return 0;
  } catch (err) {
    const message = `${(err as Error).name ?? 'Error'}: ${(err as Error).message ?? String(err)}`;
    finishRun(runId, {
      status: 'failed',
      exitCode: 1,
      message: message.slice(0, 500),
      path: dbPath,
    });
    process.stdout.write(JSON.stringify({ ok: false, error: message }, null, 1) + '\n');
    return 1;
  }
}
