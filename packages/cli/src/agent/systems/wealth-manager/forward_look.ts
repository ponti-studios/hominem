#!/usr/bin/env node
/**
 * Layer 3 — the Forward Look (WYA-229), ported 2026-11-22 from
 * archive systems-live/wealth-manager/forward_look.py. Weekly forward
 * cash view over the 30 days AFTER as_of: [as_of + 1, as_of + 30].
 * Reads Hominem (the system of record) plus one public FX reference
 * rate, and writes nothing at all. The data rule (Charlie, 2026-11-06)
 * carries verbatim: Plaid is INGEST ONLY and is never a source for
 * analysis. Prints one object:
 *
 *   {"ok": true, "as_of": "...", "horizon_days": 30,
 *    "horizon": {"from": "...", "to": "..."}, "sections": {...}}
 *
 * Sections:
 *   1. timeline_gbp / timeline_usd — dated expected outflows and known
 *      inflows per currency, never combined. Bills come from
 *      finance_bill_list: fixed bills project at their registered
 *      expected amount on each due date inside the horizon (anchored on
 *      the server-computed nextDueDate, stepped by cadence); variable
 *      bills carry no expected amount by design, so their due dates
 *      are listed in diagnostics instead of being guessed at; top-up
 *      bills have no cadence (pay-as-you-go) and are watched by
 *      balance, not date. Salary is projected monthly from ledger
 *      history — the search rule lives in
 *      forward_look_inputs.json, never in this file.
 *   2. pinch_points — day-by-day projection of each currency's liquid
 *      balance (open checking + savings) applying that currency's
 *      timeline: every date below the machine-local floor, every day
 *      whose total outflows exceed 1,000, the projected minimum and
 *      the ending balance. Fixed bills are treated as cash outflows on
 *      their due dates — the standard Forward Look approximation;
 *      variable bills and card spending inside the horizon are unknown
 *      and not projected.
 *   3. runway — finance_runway called with the only parameters the
 *      tool accepts (asOf, projectionWeeks covering the horizon,
 *      monthlyBudgets). The tool takes NO currency or account-set
 *      parameter — it uses the user-selected forecast currency
 *      server-side — so it is called once and its raw output recorded
 *      verbatim, next to the liquid balances it should reconcile to.
 *      If it returns zeros (no forecast currency selected), the
 *      section says so; nothing is fabricated.
 *   4. utilisation — per OPEN credit card: owed (Hominem card balances
 *      are negative, so owed = -balance), limit from
 *      forward_look_inputs.json (no limits are stored in Hominem),
 *      utilisation % = owed / limit. A card without a registered limit
 *      is balance only (charge card), reason stated. Closed cards are
 *      excluded.
 *   5. fx_runway — months of GBP cover from USD liquid balances:
 *      (USD liquid x live USD->GBP rate) / average monthly GBP spend,
 *      the average over the last three complete months (Transfers and
 *      Adjustment excluded — plumbing and plugs, not spend). If the
 *      rate cannot be fetched, the section is omitted and diagnostics
 *      says why.
 *
 * Deliberate deltas from the archive (recorded 2026-11-22):
 *   - Under the 2026-11-22 ruling nothing personal is hardcoded: the
 *     salary search (query, payroll-size floor, currency, lookback,
 *     label) and every balance floor / card limit moved to
 *     $HOMINEM_AGENT_WEALTH_DIR/forward_look_inputs.json (machine-local, law
 *     4; same keys the archived code read: balance_floors,
 *     credit_limits_usd — the latter's name is historical, its limits
 *     apply to every open card whatever the currency). A missing file
 *     degrades to a floorless, balance-only, salary-less look with a
 *     named diagnostics note — the archived inputs file lived beside
 *     the script and crashed the run when absent.
 *   - Budgets for finance_runway are Hominem data now, not the retired
 *     taxonomy.json: monthly category-level rows from
 *     finance_budget_list (one extra read per run, counted in
 *     hominem_calls). Non-monthly category budgets cannot be
 *     month-projected (the archived projection is month math) and are
 *     named in diagnostics instead; tag budgets are sub-caps, not
 *     category caps, and never reach the tool.
 *   - The archived inference strings about one specific payslip and
 *     one specific bill's due day were personal history, not engine
 *     logic: the salary inference now states what the history actually
 *     shows (including single-observation dependence when that is the
 *     case), and a per-bill data-quality note belongs in Hominem's
 *     bills register, not in this code.
 *   - --date became the WEALTH_SYNC_TODAY env pin (Layer 2 precedent),
 *     and the FX endpoint resolves from WEALTH_FX_URL (default: the
 *     Frankfurter ECB reference rate) so the routine stays hermetic
 *     under test (law 4). The archived fx window also computed a
 *     92-day lookback variable it never used; only the
 *     three-complete-months window is real, so only that is ported.
 *   - The archived FX fetch bypassed the logging wrapper (plain
 *     urllib); law 1 applies now, so the rate fetch lands its own
 *     `fx-rate` events row. The ponti_log subprocess (hatch path)
 *     became the HominemMcp HTTP client — every call lands an events
 *     row, the count still reported in diagnostics as hominem_calls.
 *
 * Env (law 4): HOMINEM_MCP_URL + HOMINEM_MCP_TOKEN (the backbone —
 * missing fails the run by name), HOMINEM_AGENT_WEALTH_DIR (default
 * ~/.hominem/wealth), WEALTH_SYNC_TODAY (pin the as-of date),
 * WEALTH_FX_URL (default: Frankfurter USD->GBP reference rate).
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { finishRun, logEvent, logRun } from '../../log/agent_log.ts';
import { applyEnvDefaults, envOr } from './env.ts';
import {
  HominemMcp,
  type HominemBillRow,
  type RunwayMonthlyBudget,
  type RunwayResult,
} from './hominem.ts';
import { isoAddMonths, isoMinusDays, isoPlusDays, round2, type HominemAccount } from './types.ts';

const HORIZON_DAYS = 30;
const LARGE_OUTFLOW = 1000.0;
const LIQUID_TYPES = new Set(['checking', 'savings']);
const SPEND_EXCLUDED_CATEGORIES = new Set(['Transfers', 'Adjustment']);
const CADENCE_STEP_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, annual: 12 };
const FX_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=GBP';
const FX_TIMEOUT_MS = 20_000;

/** Machine-local inputs — never repo content (2026-11-22 ruling). */
interface ForwardLookInputs {
  /** currency -> minimum acceptable projected balance; null = none set. */
  balance_floors?: Record<string, number | null>;
  /**
   * Card limits keyed by card name (the key name is historical — the
   * limits apply to every open card whatever its currency; lookup is
   * exact-name first, then normalized no-spaces lowercase). A card
   * without an entry is balance only.
   */
  credit_limits_usd?: Record<string, number>;
  /** The salary projection rule — a personal input, never hardcoded. */
  salary?: {
    query: string;
    min_amount: number;
    currency: string;
    lookback_days: number;
    label: string;
  };
}

/** One dated timeline entry: outflows negative, inflows positive. */
interface TimelineEntry {
  date: string;
  label: string;
  amount: number;
  currency: string;
  source: string;
  inferred: boolean;
}

/** One projected day of one currency's liquid balance. */
interface DailyRow {
  date: string;
  in: number;
  out: number;
  projected_balance: number;
}

interface PinchRow {
  currency: string;
  starting_balance: number;
  floor: number | null;
  days_below_floor: { date: string; projected_balance: number }[];
  large_outflow_days: { date: string; total_outflows: number }[];
  min_projected: { date: string; balance: number };
  ending_balance: number;
  daily: DailyRow[];
}

interface CardUtilisation {
  card: string;
  currency: string;
  balance_owed: number;
  limit: number | null;
  utilisation_pct: number | null;
  reason?: string;
}

interface FxRunwayRow {
  usd_liquid_balance: number;
  rate_usd_to_gbp: number;
  rate_date: string | null;
  rate_source: string;
  usd_in_gbp: number;
  average_monthly_gbp_spend: number;
  spend_window: { from: string; to: string };
  months_of_gbp_cover: number | null;
}

interface VariableDueRow {
  bill: string;
  provider: string | null;
  date: string;
  currency: string;
}

interface BillsDiag {
  bill_count: number;
  variable_due: VariableDueRow[];
  topups: { bill: string; provider: string | null; payg: unknown }[];
  inactive: string[];
}

function todayIso(): string {
  return process.env.WEALTH_SYNC_TODAY ?? new Date().toLocaleDateString('en-CA');
}

function wealthDir(): string {
  return envOr('HOMINEM_AGENT_WEALTH_DIR', join(homedir(), '.hominem', 'wealth'));
}

function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

// -------------------------------------------------------------------- dates

/** All occurrences of a monthly recurring date inside the horizon,
 * stepped from d0 with the archived 60-step guard. */
function rollInto(
  d0: string,
  horizonStart: string,
  horizonEnd: string,
  stepMonths: number,
): string[] {
  const out: string[] = [];
  let cur = d0;
  let guard = 0;
  while (cur < horizonStart && guard < 60) {
    cur = isoAddMonths(cur, stepMonths);
    guard += 1;
  }
  while (cur <= horizonEnd) {
    out.push(cur);
    cur = isoAddMonths(cur, stepMonths);
  }
  return out;
}

/** Due dates of one bill inside the horizon: anchored on the
 * server-computed nextDueDate and stepped by cadence; one_off bills
 * use their stored dueDate; top-up bills have no cadence and no dates. */
function billOccurrences(bill: HominemBillRow, horizonStart: string, horizonEnd: string): string[] {
  if (bill.cadence === 'one_off' || bill.dueDate) {
    if (!bill.dueDate) return [];
    return bill.dueDate >= horizonStart && bill.dueDate <= horizonEnd ? [bill.dueDate] : [];
  }
  if (!bill.nextDueDate) return [];
  let d0 = bill.nextDueDate;
  const cadence = bill.cadence ?? 'monthly';
  const out: string[] = [];
  if (cadence === 'weekly') {
    while (d0 < horizonStart) d0 = isoPlusDays(d0, 7);
    while (d0 <= horizonEnd) {
      out.push(d0);
      d0 = isoPlusDays(d0, 7);
    }
    return out;
  }
  const step = CADENCE_STEP_MONTHS[cadence];
  if (step === undefined) return [];
  while (d0 < horizonStart) d0 = isoAddMonths(d0, step);
  while (d0 <= horizonEnd) {
    out.push(d0);
    d0 = isoAddMonths(d0, step);
  }
  return out;
}

// ---------------------------------------------------------------- accounts

function liquidBalances(accounts: HominemAccount[]): {
  totals: Record<string, number>;
  detail: Record<string, { account: string; balance: number }[]>;
} {
  const rawTotals: Record<string, number> = {};
  const detail: Record<string, { account: string; balance: number }[]> = {};
  for (const a of accounts) {
    if (a.lifecycleStatus !== 'open') continue;
    if (!LIQUID_TYPES.has(a.accountType)) continue;
    const cur = a.currencyCode;
    rawTotals[cur] = (rawTotals[cur] ?? 0) + (a.balance ?? 0);
    (detail[cur] ??= []).push({ account: a.name, balance: round2(a.balance ?? 0) });
  }
  const totals: Record<string, number> = {};
  for (const [cur, total] of Object.entries(rawTotals)) totals[cur] = round2(total);
  return { totals, detail };
}

// -------------------------------------------------------------------- bills

async function billEntries(
  hominem: HominemMcp,
  horizonStart: string,
  horizonEnd: string,
  notes: string[],
): Promise<{ entries: TimelineEntry[]; diag: BillsDiag }> {
  const res = await hominem.billList();
  const bills = res.bills;
  const entries: TimelineEntry[] = [];
  const variableDue: VariableDueRow[] = [];
  const topups: { bill: string; provider: string | null; payg: unknown }[] = [];
  const inactive: string[] = [];
  for (const b of bills) {
    const name = b.name || b.providerName || 'Bill';
    if (b.status !== 'active' || b.type === 'cancelled' || b.isDismissed) {
      inactive.push(name);
      continue;
    }
    if (b.amountModel === 'top_up') {
      topups.push({ bill: name, provider: b.providerName, payg: b.payg });
      continue;
    }
    const occ = billOccurrences(b, horizonStart, horizonEnd);
    const amountCents = b.expectedAmountCents;
    if (b.amountModel === 'variable' || amountCents === null) {
      for (const d0 of occ) {
        variableDue.push({
          bill: name,
          provider: b.providerName,
          date: d0,
          currency: b.currencyCode,
        });
      }
      continue;
    }
    for (const d0 of occ) {
      entries.push({
        date: d0,
        label: `${name} — ${b.providerName}`,
        amount: round2(-amountCents / 100),
        currency: b.currencyCode,
        source:
          `Hominem bill (finance_bill_list): registered ${b.cadence} bill, due day ` +
          `${b.dueDay}, expected amount from Charlie's bills register in Hominem`,
        inferred: false,
      });
    }
  }
  if (variableDue.length > 0) {
    notes.push(
      'variable bills due in horizon (amount varies with usage/statement — due dates ' +
        `known, amounts not projected): ${JSON.stringify(variableDue)}`,
    );
  }
  if (topups.length > 0) {
    notes.push(
      'top-up bills (pay-as-you-go; no cadence, watched by balance, not projected): ' +
        `${JSON.stringify(topups)}`,
    );
  }
  if (inactive.length > 0) {
    notes.push(`bills not active, not projected: ${JSON.stringify(inactive)}`);
  }
  return {
    entries,
    diag: { bill_count: bills.length, variable_due: variableDue, topups, inactive },
  };
}

// ---------------------------------------------------------- history-derived

async function salaryEntry(
  hominem: HominemMcp,
  asOf: string,
  horizonStart: string,
  horizonEnd: string,
  inputs: ForwardLookInputs,
  notes: string[],
  inferences: string[],
): Promise<TimelineEntry | null> {
  const rule = inputs.salary;
  if (!rule) {
    notes.push(
      'salary: no projection — forward_look_inputs.json carries no salary rule ' +
        '(query, min_amount, currency, lookback_days, label)',
    );
    return null;
  }
  const res = await hominem.searchTransactions({
    query: rule.query,
    from: isoMinusDays(asOf, rule.lookback_days),
    to: asOf,
    limit: 50,
  });
  const rows = res.transactions.filter(
    (t) => !t.excluded && t.amount >= rule.min_amount && t.currencyCode === rule.currency,
  );
  if (rows.length === 0) {
    notes.push(
      `salary: no payroll-sized inflow found for ledger search "${rule.query}" ` +
        `(${rule.currency} >= ${rule.min_amount} in the last ${rule.lookback_days} days) — ` +
        'no salary inflow projected',
    );
    return null;
  }
  rows.sort((a, b) => (a.postedOn < b.postedOn ? -1 : a.postedOn > b.postedOn ? 1 : 0));
  const last = rows[rows.length - 1]!;
  const lastD = last.postedOn;
  const amount = round2(last.amount);
  const occ = rollInto(lastD, horizonStart, horizonEnd, 1);
  if (occ.length === 0) return null;
  inferences.push(
    `salary: most recent payroll-sized inflow (${lastD}, ${rule.currency} ${amount.toFixed(2)}, ` +
      `found by ledger search "${rule.query}"); monthly projection on the same day-of-month at ` +
      'the same amount is an inference from observed history' +
      `${rows.length === 1 ? ' — a single observation so far' : ''}, and the pinch projection ` +
      'depends on it',
  );
  return {
    date: occ[0]!,
    label: rule.label,
    amount,
    currency: rule.currency,
    source:
      `ledger history: payroll inflow ${lastD} of ${rule.currency} ` +
      `${amount.toFixed(2)}; projected monthly`,
    inferred: true,
  };
}

// -------------------------------------------------------------------- pinch

function project(timeline: TimelineEntry[], startBalance: number, days: string[]): DailyRow[] {
  const byDay = new Map<string, TimelineEntry[]>();
  for (const e of timeline) {
    const arr = byDay.get(e.date) ?? [];
    arr.push(e);
    byDay.set(e.date, arr);
  }
  let bal = startBalance;
  const daily: DailyRow[] = [];
  for (const d of days) {
    const todays = byDay.get(d) ?? [];
    const out = round2(todays.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0));
    const inn = round2(todays.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0));
    bal = round2(bal + inn - out);
    daily.push({ date: d, in: inn, out, projected_balance: bal });
  }
  return daily;
}

function pinchPoints(
  days: string[],
  timelineGbp: TimelineEntry[],
  timelineUsd: TimelineEntry[],
  liquid: {
    totals: Record<string, number>;
    detail: Record<string, { account: string; balance: number }[]>;
  },
  inputs: ForwardLookInputs,
): Record<string, PinchRow> {
  const floors = inputs.balance_floors ?? {};
  const result: Record<string, PinchRow> = {};
  for (const [cur, timeline] of [
    ['GBP', timelineGbp],
    ['USD', timelineUsd],
  ] as const) {
    const start = liquid.totals[cur] ?? 0;
    const floor = floors[cur] ?? null;
    const daily = project(timeline, start, days);
    const below = daily
      .filter((r) => floor !== null && r.projected_balance < floor)
      .map((r) => ({ date: r.date, projected_balance: r.projected_balance }));
    const large = daily
      .filter((r) => r.out > LARGE_OUTFLOW)
      .map((r) => ({ date: r.date, total_outflows: r.out }));
    const minRow = daily.reduce(
      (m, r) => (r.projected_balance < m.projected_balance ? r : m),
      daily[0]!,
    );
    result[cur.toLowerCase()] = {
      currency: cur,
      starting_balance: start,
      floor,
      days_below_floor: below,
      large_outflow_days: large,
      min_projected: { date: minRow.date, balance: minRow.projected_balance },
      ending_balance: daily[daily.length - 1]!.projected_balance,
      daily,
    };
  }
  return result;
}

// ------------------------------------------------------------------- runway

async function sectionRunway(
  hominem: HominemMcp,
  asOf: string,
  liquid: {
    totals: Record<string, number>;
    detail: Record<string, { account: string; balance: number }[]>;
  },
  notes: string[],
): Promise<Record<string, unknown>> {
  const budgets = await hominem.budgetList();
  const monthly: RunwayMonthlyBudget[] = [];
  const skipped: string[] = [];
  for (const b of budgets.storedBudgets) {
    if (b.tagId !== null) continue; // tag budgets are sub-caps, not category caps
    if (b.cadence !== 'monthly') {
      skipped.push(`${b.categoryName} (${b.cadence})`);
      continue;
    }
    monthly.push({ category: b.categoryName, amountCents: b.amountCents });
  }
  if (skipped.length > 0) {
    notes.push(
      'budgets not monthly-cadence, not passed to finance_runway (the archived ' +
        `projection is month math only): ${skipped.join(', ')}`,
    );
  }
  const requestWeeks = Math.floor((HORIZON_DAYS + 6) / 7) + 1;
  const raw: RunwayResult = await hominem.runway({
    asOf,
    projectionWeeks: requestWeeks,
    monthlyBudgets: monthly,
  });
  // The tool returns zeros (with a warning) when no forecast currency
  // is selected server-side; detect that case explicitly.
  const weeks = raw.weeks ?? [];
  const zero =
    Number(raw.startingCash ?? 0) === 0 &&
    weeks.every((w) => Number(w.recurringOutflows ?? 0) === 0 && Number(w.endingCash ?? 0) === 0);
  const verdict = zero
    ? 'finance_runway returned all zeros: no forecast currency is selected server-side ' +
      '(see warnings in raw), so the tool cannot see any liquid accounts. This is the ' +
      'WYA-229 "called bare it returns zeros" state — the tool accepts no currency or ' +
      'account-set parameter, so it cannot be driven further from here. The pinch_points ' +
      'projection is the operative runway until a forecast currency is set in Hominem.'
    : null;
  return {
    tool: 'finance_runway',
    parameters: {
      asOf,
      projectionWeeks: requestWeeks,
      monthlyBudgets: monthly,
      note:
        'the tool accepts no currency or account-set parameter; it uses the ' +
        'user-selected forecast currency server-side',
    },
    raw,
    appears_zero_or_empty: zero,
    verdict,
    reconciled_against: { liquid_balances: liquid.totals, liquid_accounts: liquid.detail },
  };
}

// --------------------------------------------------------------- utilisation

function sectionUtilisation(
  accounts: HominemAccount[],
  inputs: ForwardLookInputs,
): CardUtilisation[] {
  const limits = inputs.credit_limits_usd ?? {};
  const norm = new Map(
    Object.entries(limits).map(([k, v]) => [k.replace(/ /g, '').toLowerCase(), v] as const),
  );
  const cards: CardUtilisation[] = [];
  for (const a of accounts) {
    if (a.accountType !== 'credit_card') continue;
    if (a.lifecycleStatus !== 'open') continue; // historical/closed cards excluded
    const owed = round2(-(a.balance ?? 0)) + 0; // + 0 kills -0
    const limit =
      limits[a.name] ?? norm.get((a.name ?? '').replace(/ /g, '').toLowerCase()) ?? null;
    if (limit === null) {
      cards.push({
        card: a.name,
        currency: a.currencyCode,
        balance_owed: owed,
        limit: null,
        utilisation_pct: null,
        reason: 'no preset limit (charge card) — balance only',
      });
    } else {
      cards.push({
        card: a.name,
        currency: a.currencyCode,
        balance_owed: owed,
        limit,
        utilisation_pct: limit ? round2((owed / limit) * 100) : null,
      });
    }
  }
  return cards;
}

// ---------------------------------------------------------------- fx runway

async function sectionFxRunway(
  hominem: HominemMcp,
  asOf: string,
  liquidTotals: Record<string, number>,
  notes: string[],
  dbPath: string | undefined,
): Promise<FxRunwayRow | null> {
  const usdLiquid = liquidTotals['USD'];
  if (usdLiquid === undefined) return null;
  const url = envOr('WEALTH_FX_URL', FX_URL);
  const tsRequest = new Date().toISOString();
  const tsRequestMs = Date.now();
  let rate: number;
  let rateDate: string | null = null;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(FX_TIMEOUT_MS) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const fx = (await resp.json()) as { rates?: { GBP?: number }; date?: string };
    rate = Number(fx.rates?.GBP);
    if (!Number.isFinite(rate)) throw new Error('no GBP rate in response');
    rateDate = fx.date ?? null;
    logEvent('fx-rate', ['frankfurter usd-gbp'], {
      tsRequest,
      tsRequestMs,
      tsResponse: new Date().toISOString(),
      tsResponseMs: Date.now(),
      httpStatus: resp.status,
      ok: true,
      params: { url },
      response: { rate, date: rateDate },
      path: dbPath,
    });
  } catch (err) {
    logEvent('fx-rate', ['frankfurter usd-gbp'], {
      tsRequest,
      tsRequestMs,
      tsResponse: new Date().toISOString(),
      tsResponseMs: Date.now(),
      ok: false,
      isError: true,
      error: (err as Error).message,
      params: { url },
      path: dbPath,
    });
    notes.push(`fx_runway omitted: live FX rate unreachable (${(err as Error).message})`);
    return null;
  }
  // Last three complete months ending with the month before as_of's month.
  const endMonth = isoMinusDays(monthStart(asOf), 1);
  const startMonth = isoAddMonths(monthStart(endMonth), -2);
  const res = await hominem.spendingByCategory({ from: startMonth, to: endMonth, limit: 50 });
  let total = 0;
  for (const c of res.categories) {
    if (c.currencyCode !== 'GBP') continue;
    if (SPEND_EXCLUDED_CATEGORIES.has(c.categoryName)) continue;
    const spent = c.spent ?? 0;
    if (spent > 0) total += spent;
  }
  const avgMonthly = round2(total / 3);
  const gbpEquiv = round2(usdLiquid * rate);
  const months = avgMonthly > 0 ? round2(gbpEquiv / avgMonthly) : null;
  notes.push(
    `fx_runway average: GBP spend ${total.toFixed(2)} over ${startMonth}..${endMonth} ` +
      '(three complete months)',
  );
  return {
    usd_liquid_balance: usdLiquid,
    rate_usd_to_gbp: rate,
    rate_date: rateDate,
    rate_source: 'Frankfurter (ECB reference rate), fetched live',
    usd_in_gbp: gbpEquiv,
    average_monthly_gbp_spend: avgMonthly,
    spend_window: { from: startMonth, to: endMonth },
    months_of_gbp_cover: months,
  };
}

// -------------------------------------------------------------------- main

interface LookEnvelope {
  ok: boolean;
  as_of: string;
  horizon_days: number;
  horizon: { from: string; to: string };
  sections: Record<string, unknown>;
}

async function runLook(
  dbPath: string | undefined,
): Promise<{ envelope: LookEnvelope; sourceErrors: Record<string, string>; message: string }> {
  const asOf = todayIso();
  const horizonStart = isoPlusDays(asOf, 1);
  const horizonEnd = isoPlusDays(asOf, HORIZON_DAYS);
  const days = Array.from({ length: HORIZON_DAYS }, (_, i) => isoPlusDays(asOf, i + 1));

  const sections: Record<string, unknown> = {};
  const notes: string[] = [];
  const inferences: string[] = [];
  const sourceErrors: Record<string, string> = {};

  // Machine-local inputs (law 4; 2026-11-22 ruling: never repo content).
  let inputs: ForwardLookInputs = {};
  const inputsPath = join(wealthDir(), 'forward_look_inputs.json');
  if (existsSync(inputsPath)) {
    try {
      inputs = JSON.parse(readFileSync(inputsPath, 'utf8')) as ForwardLookInputs;
    } catch (err) {
      sourceErrors.inputs = String((err as Error).message).slice(0, 200);
    }
  } else {
    notes.push(`inputs file absent (${inputsPath}): no floors, no card limits, no salary rule`);
  }

  const hominem = new HominemMcp({ dbPath });
  let hominemCalls = 0;
  const origCall = hominem.call.bind(hominem);
  hominem.call = ((tool: string, args: Record<string, unknown>) => {
    hominemCalls += 1;
    return origCall(tool, args);
  }) as typeof hominem.call;

  // Accounts feed every section; a failure here fails the whole run
  // (the archived contract: no accounts, no look).
  const accounts = (await hominem.listFinanceAccounts()).accounts;
  const liquid = liquidBalances(accounts);

  const timelineGbp: TimelineEntry[] = [];
  const timelineUsd: TimelineEntry[] = [];
  let billsDiag: BillsDiag = { bill_count: 0, variable_due: [], topups: [], inactive: [] };
  try {
    const { entries, diag } = await billEntries(hominem, horizonStart, horizonEnd, notes);
    billsDiag = diag;
    for (const e of entries) {
      if (e.currency === 'GBP') timelineGbp.push(e);
      else if (e.currency === 'USD') timelineUsd.push(e);
      else notes.push(`bill in unhandled currency, not projected: ${JSON.stringify(e)}`);
    }
  } catch (err) {
    sourceErrors.bills = String((err as Error).message).slice(0, 200);
  }
  try {
    const s = await salaryEntry(hominem, asOf, horizonStart, horizonEnd, inputs, notes, inferences);
    if (s) {
      if (s.currency === 'GBP') timelineGbp.push(s);
      else if (s.currency === 'USD') timelineUsd.push(s);
      else notes.push(`salary in unhandled currency, not projected: ${JSON.stringify(s)}`);
    }
  } catch (err) {
    sourceErrors.salary = String((err as Error).message).slice(0, 200);
  }

  timelineGbp.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  timelineUsd.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  sections.timeline_gbp = timelineGbp;
  sections.timeline_usd = timelineUsd;

  let pinch: Record<string, PinchRow> | null = null;
  try {
    pinch = pinchPoints(days, timelineGbp, timelineUsd, liquid, inputs);
    sections.pinch_points = pinch;
  } catch (err) {
    sourceErrors.pinch_points = String((err as Error).message).slice(0, 200);
  }
  try {
    sections.runway = await sectionRunway(hominem, asOf, liquid, notes);
  } catch (err) {
    sourceErrors.runway = String((err as Error).message).slice(0, 200);
  }
  try {
    sections.utilisation = sectionUtilisation(accounts, inputs);
  } catch (err) {
    sourceErrors.utilisation = String((err as Error).message).slice(0, 200);
  }
  let fx: FxRunwayRow | null = null;
  try {
    fx = await sectionFxRunway(hominem, asOf, liquid.totals, notes, dbPath);
    if (fx) sections.fx_runway = fx;
  } catch (err) {
    sourceErrors.fx_runway = String((err as Error).message).slice(0, 200);
  }

  const diagnostics: Record<string, unknown> = {
    hominem_calls: hominemCalls,
    bills: billsDiag,
    inferences,
    notes,
  };
  if (Object.keys(sourceErrors).length > 0) diagnostics.source_errors = sourceErrors;
  sections.diagnostics = diagnostics;

  const envelope: LookEnvelope = {
    ok: Object.keys(sourceErrors).length === 0,
    as_of: asOf,
    horizon_days: HORIZON_DAYS,
    horizon: { from: horizonStart, to: horizonEnd },
    sections,
  };
  const message =
    `${timelineGbp.length} GBP + ${timelineUsd.length} USD timeline entries, ` +
    `${pinch?.gbp?.days_below_floor.length ?? 0}/${pinch?.usd?.days_below_floor.length ?? 0} ` +
    `below-floor days, ${fx ? 'fx ok' : 'no fx section'}` +
    (Object.keys(sourceErrors).length > 0
      ? `, ${Object.keys(sourceErrors).length} source errors`
      : '');
  return { envelope, sourceErrors, message };
}

export async function main(): Promise<number> {
  applyEnvDefaults();
  const dbPath = process.env.HOMINEM_AGENT_DB; // undefined = the default audit db
  const runId = logRun('wealth-look', {
    status: 'invoked',
    context: { today: todayIso(), dir: wealthDir() },
    path: dbPath,
  });
  try {
    const { envelope, message } = await runLook(dbPath);
    finishRun(runId, { status: 'ok', exitCode: 0, message, path: dbPath });
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
