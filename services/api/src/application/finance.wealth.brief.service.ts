import type {
  FinanceWealthBriefInput,
  FinanceWealthBriefOutput,
} from '../schemas/finance.wealth.schema';
import {
  createReportReads,
  isoAddMonths,
  isoMinusDays,
  isoStepDueDate,
  isoPlusDays,
  round2,
  searchAll,
  todayIso,
  type BudgetStoredRow,
  type HominemBillRow,
  type HominemSearchRow,
  type ReportReads,
} from './finance.wealth.shared';

const LARGE_THRESHOLD = 50;
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
const TAG_PRIORITY = ['Coffee', 'Dining Out', 'Groceries'];
const BILL_CADENCE_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, annual: 12 };

type Sections = FinanceWealthBriefOutput['sections'];
type BriefFlag = NonNullable<Sections['anomalies']>[number];
type PacingRow = NonNullable<Sections['budget_pacing']>[number];
type BillRecord = NonNullable<FinanceWealthBriefOutput['snapshot']>['bills'][number];
type BillFlag = NonNullable<NonNullable<Sections['bills']>['flags']>[number];

function message(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 200);
}

function merchantKey(row: HominemSearchRow): string {
  return (row.merchantName ?? row.description ?? '').trim().toLowerCase();
}

function displayName(row: HominemSearchRow): string {
  return row.merchantName ?? row.description ?? '(unknown)';
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function sectionMoneyInOut(rows: HominemSearchRow[]) {
  const per_currency: Record<string, { in: number; out: number; net: number; count: number }> = {};
  const large_items: NonNullable<Sections['money_in_out']>['large_items'] = [];
  for (const row of rows) {
    const category = row.categoryName;
    if ((category && EXCLUDED_CATEGORIES.has(category)) || row.excluded) continue;
    const currency = row.currencyCode || 'UNKNOWN';
    const bucket = (per_currency[currency] ??= { in: 0, out: 0, net: 0, count: 0 });
    if (row.amount > 0 || category === 'Income') bucket.in += Math.abs(row.amount);
    else if (row.amount < 0) bucket.out += Math.abs(row.amount);
    bucket.net += row.amount;
    bucket.count += 1;
    if (Math.abs(row.amount) > LARGE_THRESHOLD) {
      large_items.push({
        merchant: displayName(row),
        description: row.description,
        amount: row.amount,
        currency,
        category,
        postedOn: row.postedOn,
      });
    }
  }
  for (const bucket of Object.values(per_currency)) {
    bucket.in = round2(bucket.in);
    bucket.out = round2(bucket.out);
    bucket.net = round2(bucket.net);
  }
  return {
    section: Object.keys(per_currency).length ? { per_currency, large_items } : undefined,
    large_items,
  };
}

async function tagComposition(
  reads: ReportReads,
  categoryName: string,
  tagBudgets: BudgetStoredRow[],
  from: string,
  to: string,
  currency: string,
): Promise<NonNullable<PacingRow['components']>> {
  const buckets: Record<string, number> = {};
  for (const tag of tagBudgets) if (tag.tagName) buckets[tag.tagName] = 0;
  // A row counts toward one tag: the usual three win, then any other budgeted tag by name.
  const others = Object.keys(buckets)
    .filter((name) => !TAG_PRIORITY.includes(name))
    .sort();
  const priority = [...TAG_PRIORITY, ...others];
  const rows = await searchAll(reads, { categoryName, from, to });
  for (const row of rows) {
    if (row.excluded || row.pending || row.currencyCode !== currency || row.amount >= 0) continue;
    for (const name of priority) {
      if (name in buckets && row.tags.includes(name)) {
        buckets[name] = (buckets[name] ?? 0) + Math.abs(row.amount);
        break;
      }
    }
  }
  return Object.fromEntries(
    tagBudgets
      .filter((budget) => budget.tagName !== null)
      .map((budget) => {
        const name = budget.tagName ?? '';
        const month_to_date = round2(buckets[name] ?? 0);
        return [
          name,
          {
            budget: budget.amountCents / 100,
            month_to_date,
            over_tag_budget: month_to_date > budget.amountCents / 100,
          },
        ];
      }),
  );
}

async function sectionBudgetPacing(
  reads: ReportReads,
  yesterday: string,
  diagnostics: Sections['diagnostics'],
): Promise<PacingRow[]> {
  const monthStart = `${yesterday.slice(0, 7)}-01`;
  const daysInMonth = Number(isoMinusDays(isoAddMonths(monthStart, 1), 1).slice(8));
  const dayOfMonth = Number(yesterday.slice(8));
  const budgets = await reads.budgetList(yesterday);
  if (!budgets.primaryCurrency) {
    diagnostics.pacing_skipped =
      budgets.warning ?? 'hominem reports no primary currency; pacing needs one';
    return [];
  }
  const currency = budgets.primaryCurrency;
  const report = await reads.spendingByCategory({ from: monthStart, to: yesterday, limit: 50 });
  if (report.truncated) {
    throw new Error('Spending by category is truncated; budget pacing cannot be reconciled.');
  }
  const spent = new Map(
    report.categories.map((category) => [
      `${category.categoryName}|${category.currencyCode}`,
      category.spent,
    ]),
  );
  const categoryBudgets = budgets.storedBudgets.filter((budget) => budget.tagId === null);
  const breachedCats = new Set(budgets.breaches.map((breach) => breach.categoryName));
  const entries: PacingRow[] = [];
  const detail: Record<string, PacingRow> = {};
  for (const budgetRow of categoryBudgets) {
    if (budgetRow.cadence !== 'monthly') continue;
    const budget = budgetRow.amountCents / 100;
    const mtd = spent.get(`${budgetRow.categoryName}|${currency}`) ?? 0;
    const expected = (budget * dayOfMonth) / daysInMonth;
    const projected = (mtd / dayOfMonth) * daysInMonth;
    const row: PacingRow = {
      category: budgetRow.categoryName,
      currency,
      budget,
      month_to_date: round2(mtd),
      expected_by_now: round2(expected),
      projected_month_end: round2(projected),
      month: yesterday.slice(0, 7),
      day_of_month: dayOfMonth,
      days_in_month: daysInMonth,
    };
    const tagBudgets = budgets.storedBudgets.filter(
      (candidate) => candidate.categoryId === budgetRow.categoryId && candidate.tagId !== null,
    );
    if (tagBudgets.length) {
      row.components = await tagComposition(
        reads,
        budgetRow.categoryName,
        tagBudgets,
        monthStart,
        yesterday,
        currency,
      );
      const over = Object.entries(row.components)
        .filter(([, component]) => component.over_tag_budget)
        .map(([name]) => name);
      if (over.length && projected <= budget) {
        row.mix_note =
          `mix is lopsided: ${over.join(', ')} over their tag budgets — composition ` +
          `only, not a breach (${budgetRow.categoryName} is within budget)`;
      }
    }
    if (breachedCats.has(budgetRow.categoryName)) row.over_budget = true;
    if (projected > budget) row.reason = 'projected month-end exceeds budget';
    else if (mtd > expected * 1.2) row.reason = 'pace >20% ahead of expected';
    detail[budgetRow.categoryName] = row;
    if (row.reason) entries.push(row);
  }
  for (const breach of budgets.breaches) {
    if (entries.some((entry) => entry.category === breach.categoryName)) continue;
    const stored = categoryBudgets.find((budget) => budget.categoryName === breach.categoryName);
    entries.push({
      category: breach.categoryName,
      currency,
      budget: stored ? stored.amountCents / 100 : 0,
      month_to_date: round2(spent.get(`${breach.categoryName}|${currency}`) ?? 0),
      reason: `over budget — hominem reports over by ${round2(breach.overByCents / 100).toFixed(2)}`,
      over_budget: true,
    });
  }
  diagnostics.pacing_all = detail;
  return entries;
}

async function sectionAnomalies(
  reads: ReportReads,
  yesterdayRows: HominemSearchRow[],
  yesterday: string,
  sourceErrors: Record<string, string>,
): Promise<BriefFlag[]> {
  const flags: BriefFlag[] = [];
  const rows = yesterdayRows.filter((row) => !row.excluded && !row.pending);
  const groups = new Map<string, HominemSearchRow[]>();
  for (const row of rows) {
    const key = `${merchantKey(row)}|${row.amount}|${row.currencyCode}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const [key, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const first = group[0];
    if (group.length >= 2 && key.split('|')[0] && first) {
      flags.push({
        type: 'duplicate_charge',
        merchant: displayName(first),
        amount: first.amount,
        currency: first.currencyCode,
        count: group.length,
        detail: `${group.length} identical charges on ${yesterday}`,
      });
    }
  }
  for (const row of rows) {
    const text =
      `${row.description ?? ''} ${row.merchantName ?? ''} ${row.categoryName ?? ''}`.toLowerCase();
    let detail: string | null = null;
    if (FX_TOKENS.some((token) => text.includes(token))) {
      detail = `row text indicates an FX/foreign charge: "${row.description}"`;
    } else if (row.currencyCode && row.currencyCode !== 'GBP' && row.currencyCode !== 'USD') {
      detail = `charge in non-GBP/USD currency ${row.currencyCode}: "${row.description}"`;
    }
    if (detail) {
      flags.push({
        type: 'fx_charge',
        merchant: displayName(row),
        amount: row.amount,
        currency: row.currencyCode,
        detail,
      });
    }
  }
  const merchants = [...new Set(rows.map(merchantKey).filter(Boolean))];
  for (const merchant of merchants.slice(0, MAX_HISTORY_MERCHANTS)) {
    const todays = rows.filter((row) => merchantKey(row) === merchant);
    const first = todays[0];
    if (!first) continue;
    try {
      const result = await reads.searchTransactions({
        query: displayName(first),
        from: isoMinusDays(yesterday, HISTORY_DAYS),
        to: isoMinusDays(yesterday, 1),
        limit: 50,
      });
      const prior = result.transactions
        .filter((row) => merchantKey(row) === merchant && !row.excluded && !row.pending)
        .map((row) => Math.abs(row.amount));
      for (const row of todays) {
        const amount = Math.abs(row.amount);
        if (!prior.length && amount > LARGE_THRESHOLD) {
          flags.push({
            type: 'first_seen_merchant',
            merchant: displayName(row),
            amount: row.amount,
            currency: row.currencyCode,
            detail: `no occurrence in prior ${HISTORY_DAYS} days and over the £50/$50 threshold`,
          });
        } else if (prior.length >= 3) {
          const med = median(prior);
          const mad = median(prior.map((value) => Math.abs(value - med)));
          const overDouble = amount > 2 * med;
          const overMad = mad > 0 && amount > med + 3 * 1.4826 * mad;
          if (overDouble || overMad) {
            flags.push({
              type: 'amount_anomaly',
              merchant: displayName(row),
              amount: row.amount,
              currency: row.currencyCode,
              detail:
                `prior ${prior.length} charges: median ${med.toFixed(2)}, MAD ${mad.toFixed(2)}; ` +
                `today ${amount.toFixed(2)} breaches ${overDouble ? '2x median' : 'median+3*MAD'}`,
            });
          }
        }
      }
    } catch (error) {
      sourceErrors[`history:${merchant}`] = message(error);
    }
  }
  return flags;
}

function billRecord(bill: HominemBillRow): BillRecord {
  return {
    id: bill.id,
    name: bill.name,
    provider: bill.providerName,
    kind: bill.kind,
    amount_model: bill.amountModel,
    expected_amount: bill.expectedAmountCents === null ? null : bill.expectedAmountCents / 100,
    currency: bill.currencyCode,
    cadence: bill.cadence,
    due_day: bill.dueDay,
    status: bill.status,
    type: bill.type,
    next_due: bill.nextDueDate,
    last_paid_on: bill.lastPaid?.postedOn ?? null,
    match_configured: bill.merchantMatch.length > 0,
    created_on: bill.createdAt.slice(0, 10) || null,
  };
}

function stepBack(due: string, cadence: string | null, dueDay: number | null): string | null {
  if (cadence === 'weekly') return isoMinusDays(due, 7);
  const months = BILL_CADENCE_MONTHS[cadence ?? 'monthly'];
  return months === undefined ? null : isoStepDueDate(due, -months, dueDay);
}

function diffBills(previous: BillRecord[], current: BillRecord[], date: string): BillFlag[] {
  const flags: BillFlag[] = [];
  const old = new Map(previous.filter((bill) => bill.id).map((bill) => [bill.id, bill]));
  const now = new Map(current.filter((bill) => bill.id).map((bill) => [bill.id, bill]));
  for (const [id, bill] of [...now].sort(([a], [b]) => a.localeCompare(b))) {
    if (!old.has(id)) {
      flags.push({
        type: 'new_bill',
        bill: bill.name,
        provider: bill.provider,
        detail: 'bill not present in previous snapshot',
      });
    }
  }
  for (const [id, bill] of [...old].sort(([a], [b]) => a.localeCompare(b))) {
    const next = now.get(id);
    if (bill.status === 'active' && (!next || next.status !== 'active')) {
      flags.push({
        type: 'bill_inactive',
        bill: bill.name,
        provider: bill.provider,
        detail: `was active in previous snapshot, now ${next?.status ?? 'missing'}`,
      });
      continue;
    }
    if (!next || bill.expected_amount === null || next.expected_amount === null) continue;
    if (bill.expected_amount !== next.expected_amount) {
      flags.push({
        type: 'bill_amount_change',
        bill: next.name,
        provider: next.provider,
        previous_amount: bill.expected_amount,
        amount: next.expected_amount,
        currency: next.currency,
        detail: `expected amount changed ${bill.expected_amount.toFixed(2)} -> ${next.expected_amount.toFixed(2)}`,
      });
    }
  }
  for (const [, bill] of [...now].sort(([a], [b]) => a.localeCompare(b))) {
    if (
      bill.status !== 'active' ||
      !bill.match_configured ||
      !bill.next_due ||
      !bill.cadence ||
      bill.cadence === 'one_off'
    )
      continue;
    const lastDue = stepBack(bill.next_due, bill.cadence, bill.due_day);
    if (!lastDue || lastDue >= date || (bill.created_on && lastDue < bill.created_on)) continue;
    const graceStart = isoMinusDays(lastDue, 3);
    if (bill.last_paid_on === null || bill.last_paid_on < graceStart) {
      flags.push({
        type: 'bill_overdue',
        bill: bill.name,
        provider: bill.provider,
        due_date: lastDue,
        last_paid_on: bill.last_paid_on,
        detail: `due ${lastDue}; no matched payment on or after ${graceStart}`,
      });
    }
  }
  return flags;
}

export async function runBrief(
  ownerUserId: string,
  input: FinanceWealthBriefInput,
): Promise<FinanceWealthBriefOutput> {
  const date = input.date ?? todayIso();
  const yesterday = isoMinusDays(date, 1);
  const reads = createReportReads(ownerUserId, date);
  const diagnostics: Sections['diagnostics'] = { yesterday, hominem_calls: 0 };
  const sections: Sections = { diagnostics };
  const sourceErrors: Record<string, string> = {};
  let largeItems: NonNullable<Sections['money_in_out']>['large_items'] = [];
  let pacingEntries: PacingRow[] = [];
  let anomalyFlags: BriefFlag[] = [];
  let billFlags: BillFlag[] = [];
  let snapshot: FinanceWealthBriefOutput['snapshot'] = null;

  if (!input.bills_only) {
    let rows: HominemSearchRow[] = [];
    try {
      const result = await reads.searchTransactions({ from: yesterday, to: yesterday, limit: 50 });
      rows = result.transactions;
      if (result.filteredCount > rows.length)
        diagnostics.yesterday_truncated = result.filteredCount;
    } catch (error) {
      sourceErrors.yesterday_rows = message(error);
    }
    const money = sectionMoneyInOut(rows);
    largeItems = money.large_items;
    if (money.section) sections.money_in_out = money.section;
    try {
      pacingEntries = await sectionBudgetPacing(reads, yesterday, diagnostics);
      if (pacingEntries.length) sections.budget_pacing = pacingEntries;
    } catch (error) {
      sourceErrors.budget_pacing = message(error);
    }
    try {
      anomalyFlags = await sectionAnomalies(reads, rows, yesterday, sourceErrors);
      if (anomalyFlags.length) sections.anomalies = anomalyFlags;
    } catch (error) {
      sourceErrors.anomalies = message(error);
    }
  }

  try {
    const result = await reads.billList();
    const bills = result.bills
      .filter((bill) => bill.type !== 'cancelled' && !bill.isDismissed)
      .map(billRecord);
    snapshot = { bills };
    const active = bills.filter((bill) => bill.status === 'active');
    const dueSoon = active
      .filter(
        (bill) => bill.next_due && date <= bill.next_due && bill.next_due <= isoPlusDays(date, 3),
      )
      .map((bill) => ({
        bill: bill.name,
        provider: bill.provider,
        date: bill.next_due,
        amount: bill.expected_amount,
        currency: bill.currency,
      }));
    if (input.snapshot) {
      billFlags = diffBills(input.snapshot.bills, bills, date);
      sections.bills = {
        active_bills: active.length,
        previous_bills: input.snapshot.bills.length,
        due_soon: dueSoon,
        ...(billFlags.length ? { flags: billFlags } : {}),
      };
    } else {
      sections.bills = { baseline_created: true, active_bills: active.length, due_soon: dueSoon };
    }
  } catch (error) {
    sourceErrors.bills = message(error);
  }
  diagnostics.hominem_calls = reads.calls;
  if (Object.keys(sourceErrors).length) diagnostics.source_errors = sourceErrors;
  return {
    ok: Object.keys(sourceErrors).length === 0 || !!sections.money_in_out || !!sections.bills,
    date,
    sections,
    silent:
      !anomalyFlags.length && !billFlags.length && !largeItems.length && !pacingEntries.length,
    run_id: input.run_id ?? null,
    snapshot,
  };
}
