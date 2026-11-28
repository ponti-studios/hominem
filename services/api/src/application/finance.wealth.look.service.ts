import type { FinanceAccountRoute } from '@hominem/finance-services';

import type {
  FinanceWealthLookInput,
  FinanceWealthLookOutput,
} from '../schemas/finance.wealth.schema';
import {
  createReportReads,
  isoAddMonths,
  isoMinusDays,
  isoPlusDays,
  isoStepDueDate,
  matchesMerchant,
  round2,
  searchAll,
  todayIso,
  type HominemBillRow,
  type ReportReads,
} from './finance.wealth.shared';

const HORIZON_DAYS = 30;
const LARGE_OUTFLOW = 1000;
const LIQUID_TYPES = new Set(['checking', 'savings']);
const SPEND_EXCLUDED_CATEGORIES = new Set(['Transfers', 'Adjustment']);
const CADENCE_STEP_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, annual: 12 };

type Sections = FinanceWealthLookOutput['sections'];
type TimelineEntry = Sections['timeline_gbp'][number];
type PinchRow = NonNullable<Sections['pinch_points']>[string];
type BillsDiag = Sections['diagnostics']['bills'];
type ForwardLookInputs = NonNullable<FinanceWealthLookInput['inputs']>;

function message(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 200);
}

function rollInto(start: string, from: string, to: string, months: number): string[] {
  const result: string[] = [];
  let date = start;
  // Always step from the first date, so a short month's clamp doesn't stick.
  for (let step = 1; date <= to; step += 1) {
    if (date >= from) result.push(date);
    date = isoAddMonths(start, step * months);
  }
  return result;
}

function billOccurrences(bill: HominemBillRow, from: string, to: string): string[] {
  if (bill.cadence === 'one_off' || bill.dueDate) {
    return bill.dueDate && bill.dueDate >= from && bill.dueDate <= to ? [bill.dueDate] : [];
  }
  if (!bill.nextDueDate) return [];
  let date = bill.nextDueDate;
  const cadence = bill.cadence ?? 'monthly';
  const result: string[] = [];
  if (cadence === 'weekly') {
    while (date < from) date = isoPlusDays(date, 7);
    while (date <= to) {
      result.push(date);
      date = isoPlusDays(date, 7);
    }
    return result;
  }
  const months = CADENCE_STEP_MONTHS[cadence];
  if (months === undefined) return [];
  // Always step from the first date, so a missing due day can't drift either.
  for (let step = 1; date <= to; step += 1) {
    if (date >= from) result.push(date);
    date = isoStepDueDate(bill.nextDueDate, step * months, bill.dueDay);
  }
  return result;
}

function liquidBalances(accounts: FinanceAccountRoute[]) {
  const totals: Record<string, number> = {};
  const detail: Record<string, { account: string; balance: number }[]> = {};
  for (const account of accounts) {
    if (account.lifecycleStatus !== 'open' || !LIQUID_TYPES.has(account.accountType)) continue;
    totals[account.currencyCode] = (totals[account.currencyCode] ?? 0) + account.balance;
    (detail[account.currencyCode] ??= []).push({
      account: account.name,
      balance: round2(account.balance),
    });
  }
  for (const currency of Object.keys(totals)) totals[currency] = round2(totals[currency] ?? 0);
  return { totals, detail };
}

async function billEntries(
  reads: ReportReads,
  from: string,
  to: string,
  notes: string[],
): Promise<{ entries: TimelineEntry[]; diag: BillsDiag }> {
  const { bills } = await reads.billList();
  const entries: TimelineEntry[] = [];
  const variable_due: BillsDiag['variable_due'] = [];
  const topups: BillsDiag['topups'] = [];
  const inactive: string[] = [];
  for (const bill of bills) {
    const name = bill.name || bill.providerName || 'Bill';
    if (bill.status !== 'active' || bill.type === 'cancelled' || bill.isDismissed) {
      inactive.push(name);
      continue;
    }
    if (bill.amountModel === 'top_up') {
      topups.push({ bill: name, provider: bill.providerName, payg: bill.payg });
      continue;
    }
    const dates = billOccurrences(bill, from, to);
    if (bill.amountModel === 'variable' || bill.expectedAmountCents === null) {
      for (const date of dates) {
        variable_due.push({
          bill: name,
          provider: bill.providerName,
          date,
          currency: bill.currencyCode,
        });
      }
      continue;
    }
    for (const date of dates) {
      entries.push({
        date,
        label: `${name} — ${bill.providerName}`,
        amount: round2(-bill.expectedAmountCents / 100),
        currency: bill.currencyCode,
        source:
          `Hominem bill (finance_bill_list): registered ${bill.cadence} bill, due day ` +
          `${bill.dueDay}, expected amount from the bills register in Hominem`,
        inferred: false,
      });
    }
  }
  if (variable_due.length) {
    notes.push(
      'variable bills due in horizon (amount varies with usage/statement — due dates ' +
        `known, amounts not projected): ${JSON.stringify(variable_due)}`,
    );
  }
  if (topups.length) {
    notes.push(
      'top-up bills (pay-as-you-go; no cadence, watched by balance, not projected): ' +
        JSON.stringify(topups),
    );
  }
  if (inactive.length) notes.push(`bills not active, not projected: ${JSON.stringify(inactive)}`);
  return { entries, diag: { bill_count: bills.length, variable_due, topups, inactive } };
}

async function salaryEntries(
  reads: ReportReads,
  asOf: string,
  from: string,
  to: string,
  inputs: ForwardLookInputs,
  notes: string[],
  inferences: string[],
): Promise<TimelineEntry[]> {
  const rule = inputs.salary;
  if (!rule) {
    notes.push(
      'salary: no projection — forward look inputs carry no salary rule ' +
        '(query, min_amount, currency, lookback_days, label)',
    );
    return [];
  }
  const result = await searchAll(reads, {
    query: rule.query,
    from: isoMinusDays(asOf, rule.lookback_days),
    to: asOf,
  });
  const rows = result
    .filter(
      (row) =>
        !row.excluded &&
        !row.pending &&
        row.amount >= rule.min_amount &&
        row.currencyCode === rule.currency &&
        matchesMerchant(row, rule.query),
    )
    .sort((a, b) => a.postedOn.localeCompare(b.postedOn));
  const last = rows.at(-1);
  if (!last) {
    notes.push(
      `salary: no payroll-sized inflow found for ledger search "${rule.query}" ` +
        `(${rule.currency} >= ${rule.min_amount} in the last ${rule.lookback_days} days) — ` +
        'no salary inflow projected',
    );
    return [];
  }
  const amount = round2(last.amount);
  const dates = rollInto(last.postedOn, from, to, 1);
  if (!dates.length) return [];
  inferences.push(
    `salary: most recent payroll-sized inflow (${last.postedOn}, ${rule.currency} ${amount.toFixed(2)}, ` +
      `found by ledger search "${rule.query}"); monthly projection on the same day-of-month at ` +
      'the same amount is an inference from observed history' +
      `${rows.length === 1 ? ' — a single observation so far' : ''}, and the pinch projection ` +
      'depends on it',
  );
  return dates.map((date) => ({
    date,
    label: rule.label,
    amount,
    currency: rule.currency,
    source: `ledger history: payroll inflow ${last.postedOn} of ${rule.currency} ${amount.toFixed(2)}; projected monthly`,
    inferred: true,
  }));
}

function project(timeline: TimelineEntry[], start: number, days: string[]) {
  let balance = start;
  return days.map((date) => {
    const entries = timeline.filter((entry) => entry.date === date);
    const out = round2(
      entries.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum - entry.amount, 0),
    );
    const incoming = round2(
      entries.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0),
    );
    balance = round2(balance + incoming - out);
    return { date, in: incoming, out, projected_balance: balance };
  });
}

function pinchPoints(
  days: string[],
  timelineGbp: TimelineEntry[],
  timelineUsd: TimelineEntry[],
  liquid: ReturnType<typeof liquidBalances>,
  inputs: ForwardLookInputs,
): Record<string, PinchRow> {
  const result: Record<string, PinchRow> = {};
  for (const [currency, timeline] of [
    ['GBP', timelineGbp],
    ['USD', timelineUsd],
  ] as const) {
    const start = liquid.totals[currency] ?? 0;
    const floor = inputs.balance_floors?.[currency] ?? null;
    const daily = project(timeline, start, days);
    const first = daily[0];
    const last = daily.at(-1);
    if (!first || !last) continue;
    const min = daily.reduce(
      (best, row) => (row.projected_balance < best.projected_balance ? row : best),
      first,
    );
    result[currency.toLowerCase()] = {
      currency,
      starting_balance: start,
      floor,
      days_below_floor: daily
        .filter((row) => floor !== null && row.projected_balance < floor)
        .map((row) => ({ date: row.date, projected_balance: row.projected_balance })),
      large_outflow_days: daily
        .filter((row) => row.out > LARGE_OUTFLOW)
        .map((row) => ({ date: row.date, total_outflows: row.out })),
      min_projected: { date: min.date, balance: min.projected_balance },
      ending_balance: last.projected_balance,
      daily,
    };
  }
  return result;
}

async function sectionRunway(
  reads: ReportReads,
  asOf: string,
  liquid: ReturnType<typeof liquidBalances>,
  notes: string[],
): Promise<NonNullable<Sections['runway']>> {
  const budgets = await reads.budgetList();
  const monthlyBudgets: Array<{ category: string; amountCents: number }> = [];
  const skipped: string[] = [];
  for (const budget of budgets.storedBudgets) {
    if (budget.tagId !== null) continue;
    if (budget.cadence !== 'monthly') {
      skipped.push(`${budget.categoryName} (${budget.cadence})`);
      continue;
    }
    monthlyBudgets.push({ category: budget.categoryName, amountCents: budget.amountCents });
  }
  if (skipped.length) {
    notes.push(
      'budgets not monthly-cadence, not passed to finance_runway (the archived ' +
        `projection is month math only): ${skipped.join(', ')}`,
    );
  }
  const projectionWeeks = Math.floor((HORIZON_DAYS + 6) / 7) + 1;
  const raw = await reads.runway({ asOf, projectionWeeks, monthlyBudgets });
  const zero =
    raw.startingCash === 0 &&
    raw.weeks.every((week) => week.recurringOutflows === 0 && week.endingCash === 0);
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
      projectionWeeks,
      monthlyBudgets,
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

function sectionUtilisation(
  accounts: FinanceAccountRoute[],
  inputs: ForwardLookInputs,
): NonNullable<Sections['utilisation']> {
  const limits = inputs.credit_limits_usd ?? {};
  const normalized = new Map(
    Object.entries(limits).map(([name, value]) => [name.replace(/ /g, '').toLowerCase(), value]),
  );
  return accounts
    .filter(
      (account) => account.accountType === 'credit_card' && account.lifecycleStatus === 'open',
    )
    .map((account) => {
      const owed = round2(-account.balance) + 0;
      const limit =
        limits[account.name] ??
        normalized.get(account.name.replace(/ /g, '').toLowerCase()) ??
        null;
      return {
        card: account.name,
        currency: account.currencyCode,
        balance_owed: owed,
        limit,
        utilisation_pct: limit ? round2((owed / limit) * 100) : null,
        ...(limit === null ? { reason: 'no preset limit (charge card) — balance only' } : {}),
      };
    });
}

async function sectionFxRunway(
  reads: ReportReads,
  asOf: string,
  liquid: Record<string, number>,
  fx: FinanceWealthLookInput['fx'],
  notes: string[],
): Promise<NonNullable<Sections['fx_runway']> | null> {
  const usd = liquid.USD;
  if (usd === undefined) return null;
  if (!fx) {
    notes.push('fx_runway omitted: no USD-to-GBP rate supplied');
    return null;
  }
  const end = isoMinusDays(`${asOf.slice(0, 7)}-01`, 1);
  const start = isoAddMonths(`${end.slice(0, 7)}-01`, -2);
  const result = await reads.spendingByCategory({ from: start, to: end, limit: 50 });
  if (result.truncated)
    throw new Error('Spending by category is truncated; FX runway is incomplete.');
  const total = result.categories
    .filter(
      (category) =>
        category.currencyCode === 'GBP' &&
        !SPEND_EXCLUDED_CATEGORIES.has(category.categoryName) &&
        category.spent > 0,
    )
    .reduce((sum, category) => sum + category.spent, 0);
  const average = round2(total / 3);
  const equivalent = round2(usd * fx.rate_usd_to_gbp);
  notes.push(
    `fx_runway average: GBP spend ${total.toFixed(2)} over ${start}..${end} (three complete months)`,
  );
  return {
    usd_liquid_balance: usd,
    rate_usd_to_gbp: fx.rate_usd_to_gbp,
    rate_date: fx.rate_date ?? null,
    rate_source: fx.rate_source ?? 'caller-supplied',
    usd_in_gbp: equivalent,
    average_monthly_gbp_spend: average,
    spend_window: { from: start, to: end },
    months_of_gbp_cover: average > 0 ? round2(equivalent / average) : null,
  };
}

export async function runLook(
  ownerUserId: string,
  input: FinanceWealthLookInput,
): Promise<FinanceWealthLookOutput> {
  const asOf = input.as_of ?? todayIso();
  const from = isoPlusDays(asOf, 1);
  const to = isoPlusDays(asOf, HORIZON_DAYS);
  const days = Array.from({ length: HORIZON_DAYS }, (_, index) => isoPlusDays(asOf, index + 1));
  const reads = createReportReads(ownerUserId, asOf);
  const inputs = input.inputs ?? {};
  const notes: string[] = [];
  const inferences: string[] = [];
  const sourceErrors: Record<string, string> = {};
  if (asOf !== todayIso()) {
    notes.push(
      'account balances are current at run time, not reconstructed for the requested date',
    );
  }
  if (!input.inputs)
    notes.push('forward look inputs absent: no floors, no card limits, no salary rule');
  const accounts = (await reads.listFinanceAccounts()).accounts;
  const liquid = liquidBalances(accounts);
  const timeline_gbp: TimelineEntry[] = [];
  const timeline_usd: TimelineEntry[] = [];
  const diagnostics: Sections['diagnostics'] = {
    hominem_calls: 0,
    bills: { bill_count: 0, variable_due: [], topups: [], inactive: [] },
    inferences,
    notes,
  };
  const sections: Sections = { timeline_gbp, timeline_usd, diagnostics };
  const addEntry = (entry: TimelineEntry, kind: string) => {
    if (entry.currency === 'GBP') timeline_gbp.push(entry);
    else if (entry.currency === 'USD') timeline_usd.push(entry);
    else notes.push(`${kind} in unhandled currency, not projected: ${JSON.stringify(entry)}`);
  };
  try {
    const bills = await billEntries(reads, from, to, notes);
    diagnostics.bills = bills.diag;
    for (const entry of bills.entries) addEntry(entry, 'bill');
  } catch (error) {
    sourceErrors.bills = message(error);
  }
  try {
    const salary = await salaryEntries(reads, asOf, from, to, inputs, notes, inferences);
    for (const entry of salary) addEntry(entry, 'salary');
  } catch (error) {
    sourceErrors.salary = message(error);
  }
  timeline_gbp.sort((a, b) => a.date.localeCompare(b.date));
  timeline_usd.sort((a, b) => a.date.localeCompare(b.date));
  try {
    sections.pinch_points = pinchPoints(days, timeline_gbp, timeline_usd, liquid, inputs);
  } catch (error) {
    sourceErrors.pinch_points = message(error);
  }
  try {
    sections.runway = await sectionRunway(reads, asOf, liquid, notes);
  } catch (error) {
    sourceErrors.runway = message(error);
  }
  try {
    sections.utilisation = sectionUtilisation(accounts, inputs);
  } catch (error) {
    sourceErrors.utilisation = message(error);
  }
  try {
    const fx = await sectionFxRunway(reads, asOf, liquid.totals, input.fx, notes);
    if (fx) sections.fx_runway = fx;
  } catch (error) {
    sourceErrors.fx_runway = message(error);
  }
  diagnostics.hominem_calls = reads.calls;
  if (Object.keys(sourceErrors).length) diagnostics.source_errors = sourceErrors;
  return {
    ok: Object.keys(sourceErrors).length === 0,
    as_of: asOf,
    horizon_days: HORIZON_DAYS,
    horizon: { from, to },
    sections,
  };
}
