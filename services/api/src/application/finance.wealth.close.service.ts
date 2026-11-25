import type { FinanceWealthCloseInput } from '../schemas/finance.wealth.schema';
import {
  createReportReads,
  isoAddMonths,
  monthBounds,
  round2,
  searchAll,
  todayIso,
  type HominemSearchRow,
  type ReportReads,
} from './finance.wealth.shared';

const EXCLUDED_CATEGORIES = new Set(['Transfers', 'Adjustment']);
const FOOD_TAG_PRIORITY = ['Coffee', 'Dining Out', 'Groceries'];
const SYMBOLS: Record<string, string> = { GBP: '£', USD: '$' };

type MonthData = {
  spending: Awaited<ReturnType<ReportReads['spendingByCategory']>>;
  monthlyStats: Awaited<ReturnType<ReportReads['monthlyStats']>>;
  incomeRows: HominemSearchRow[];
  uncatRows: HominemSearchRow[];
  businessBreakdown: Awaited<ReturnType<ReportReads['tagBreakdown']>>;
  businessRows: HominemSearchRow[];
  budgets: Awaited<ReturnType<ReportReads['budgetList']>>;
  netWorth: Awaited<ReturnType<ReportReads['netWorth']>>;
  foodRows: HominemSearchRow[];
};
type SpendTables = Record<string, Record<string, { spent: number; count: number }>>;

function money(currency: string, amount: number): string {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

function displayName(row: HominemSearchRow): string {
  return row.merchantName || row.description || '(unknown)';
}

function isSpendRow(row: HominemSearchRow): boolean {
  return !row.excluded && !row.pending && row.amount < 0;
}

async function pullMonth(
  reads: ReportReads,
  month: string,
  warnings: string[],
): Promise<MonthData> {
  const { from, to } = monthBounds(month);
  const warn = (tool: string, warning: string) => warnings.push(`${tool}: ${warning}`);
  const spending = await reads.spendingByCategory({ from, to, limit: 50 });
  for (const warning of spending.warnings) warn('finance_spending_by_category', warning);
  if (spending.truncated) {
    warn('finance_spending_by_category', 'result truncated — totals may omit categories');
  }
  const monthlyStats = await reads.monthlyStats(month);
  for (const warning of monthlyStats.warnings) warn('finance_monthly_stats', warning);
  const incomeRows = (await searchAll(reads, { categoryName: 'Income', from, to })).filter(
    (row) => !row.excluded && !row.pending && row.amount > 0,
  );
  const uncatRows = await searchAll(reads, { categoryName: 'Uncategorized', from, to });
  const businessBreakdown = await reads.tagBreakdown({ from, to, tag: 'Business', limit: 10 });
  for (const warning of businessBreakdown.warnings) warn('finance_tag_breakdown', warning);
  const businessRows = (await searchAll(reads, { tag: 'Business', from, to })).filter(isSpendRow);
  const budgets = await reads.budgetList();
  if (budgets.warning) warn('finance_budget_list', budgets.warning);
  const netWorth = await reads.netWorth();
  for (const warning of netWorth.warnings) warn('finance_net_worth', warning);
  const foodRows = await searchAll(reads, { categoryName: 'Food', from, to });
  return {
    spending,
    monthlyStats,
    incomeRows,
    uncatRows,
    businessBreakdown,
    businessRows,
    budgets,
    netWorth,
    foodRows,
  };
}

function spendTables(data: MonthData): SpendTables {
  const tables: SpendTables = {};
  for (const category of data.spending.categories) {
    if (EXCLUDED_CATEGORIES.has(category.categoryName)) continue;
    const currency = (tables[category.currencyCode] ??= {});
    currency[category.categoryName] = {
      spent: category.spent,
      count: category.transactionCount,
    };
  }
  return tables;
}

function foodComposition(rows: HominemSearchRow[], currency: string): Record<string, number> {
  const buckets: Record<string, number> = Object.fromEntries(
    FOOD_TAG_PRIORITY.map((tag) => [tag, 0]),
  );
  for (const row of rows) {
    if (!isSpendRow(row) || row.currencyCode !== currency) continue;
    for (const name of FOOD_TAG_PRIORITY) {
      if (row.tags.includes(name)) {
        buckets[name] = (buckets[name] ?? 0) + Math.abs(row.amount);
        break;
      }
    }
  }
  for (const name of FOOD_TAG_PRIORITY) buckets[name] = round2(buckets[name] ?? 0);
  return buckets;
}

function renderCacheDiff(
  month: string,
  tables: SpendTables,
  cache: FinanceWealthCloseInput['cache'],
): string[] {
  if (!cache) {
    return [
      `- Hygiene-check cache (monthly_check_${month}_data.json): not supplied — no cache diff this close.`,
    ];
  }
  type TotalsRow = { cat: string; cur: string; spent: number };
  const cached = new Map<string, TotalsRow>();
  for (const category of cache.spending?.categories ?? []) {
    if (EXCLUDED_CATEGORIES.has(category.categoryName)) continue;
    cached.set(`${category.categoryName}\u0000${category.currencyCode}`, {
      cat: category.categoryName,
      cur: category.currencyCode,
      spent: category.spent,
    });
  }
  const live = new Map<string, TotalsRow>();
  for (const [cur, categories] of Object.entries(tables)) {
    for (const [cat, entry] of Object.entries(categories)) {
      live.set(`${cat}\u0000${cur}`, { cat, cur, spent: entry.spent });
    }
  }
  const diffs: Array<{ cat: string; cur: string; a: number | null; b: number | null }> = [];
  for (const key of [...new Set([...cached.keys(), ...live.keys()])].sort()) {
    const previous = cached.get(key);
    const current = live.get(key);
    const base = previous ?? current;
    if (!base) continue;
    if (!previous || !current || round2(previous.spent) !== round2(current.spent)) {
      diffs.push({
        cat: base.cat,
        cur: base.cur,
        a: previous?.spent ?? null,
        b: current?.spent ?? null,
      });
    }
  }
  if (!diffs.length) {
    return [
      `- Hygiene-check cache (monthly_check_${month}_data.json): every category total matches the live pull exactly.`,
    ];
  }
  return [
    `- Hygiene-check cache (monthly_check_${month}_data.json): ${diffs.length} category total(s) differ from the live pull — recategorisation since that check, shown plainly, not smoothed over:`,
    ...diffs.map((diff) => {
      const format = (value: number | null) => (value === null ? 'absent' : money(diff.cur, value));
      return `  - ${diff.cat} (${diff.cur}): hygiene ${format(diff.a)} → live ${format(diff.b)}`;
    }),
  ];
}

function render(
  month: string,
  today: string,
  defaultedMonth: boolean,
  data: MonthData,
  input: FinanceWealthCloseInput,
  warnings: string[],
  calls: number,
): string {
  const tables = spendTables(data);
  const income: Record<string, number> = {};
  for (const row of data.incomeRows) {
    const currency = row.currencyCode || 'UNKNOWN';
    income[currency] = (income[currency] ?? 0) + row.amount;
  }
  for (const currency of Object.keys(income)) income[currency] = round2(income[currency] ?? 0);
  const currencies = [...new Set([...Object.keys(tables), ...Object.keys(income)])].sort(
    (a, b) => Number(a !== 'GBP') - Number(b !== 'GBP') || a.localeCompare(b),
  );
  const spent: Record<string, number> = {};
  const net: Record<string, number> = {};
  for (const [currency, categories] of Object.entries(tables)) {
    spent[currency] = round2(
      Object.values(categories).reduce((sum, entry) => sum + entry.spent, 0),
    );
  }
  for (const currency of currencies)
    net[currency] = round2((income[currency] ?? 0) - (spent[currency] ?? 0));

  const lines = [`# Monthly close — ${month}`, ''];
  const defaultNote = defaultedMonth
    ? ` Month ${month} is the last complete month before ${today} — pin WEALTH_CLOSE_MONTH to close another.`
    : '';
  lines.push(
    `Produced by monthly_close.ts (WYA-230) on ${today}. Source: Hominem finance services ` +
      `(${calls} calls).${defaultNote} Definitions: income = Income category, posted and ` +
      'non-excluded; spend = finance_spending_by_category excluding Transfers and ' +
      'Adjustment. Currencies are never blended.',
    '',
    '## Month summary',
    '',
    '| Currency | Income | Spend | Net | Savings rate |',
    '|---|---|---|---|---|',
  );
  for (const currency of currencies) {
    const inc = income[currency] ?? 0;
    const movement = net[currency] ?? 0;
    let rate = 'n/m (no income)';
    if (inc > 0)
      rate = movement / inc >= -1 ? `${((movement / inc) * 100).toFixed(1)}%` : 'n/m (see note)';
    lines.push(
      `| ${currency} | ${money(currency, inc)} | ${money(currency, spent[currency] ?? 0)} | ${money(currency, movement)} | ${rate} |`,
    );
  }
  lines.push('');
  for (const currency of currencies) {
    const inc = income[currency] ?? 0;
    if (inc > 0 && (net[currency] ?? 0) / inc < -1) {
      lines.push(
        `Note (${currency}): savings rate not meaningful — ${currency} income recorded in Hominem this month is only ` +
          `${money(currency, inc)}; the ${currency} side runs largely through transfers, which are excluded by design. ` +
          'The net figure is the honest one.',
      );
    }
  }
  lines.push('');
  if (data.incomeRows.length) {
    lines.push('Income sources:', '');
    const sources = new Map<string, { name: string; currency: string; amount: number }>();
    for (const row of data.incomeRows) {
      const name = displayName(row);
      const currency = row.currencyCode || 'UNKNOWN';
      const key = `${name}\u0000${currency}`;
      const entry = sources.get(key);
      if (entry) entry.amount += row.amount;
      else sources.set(key, { name, currency, amount: row.amount });
    }
    for (const source of [...sources.values()].sort((a, b) => b.amount - a.amount)) {
      lines.push(`- ${source.name} — ${money(source.currency, round2(source.amount))}`);
    }
    lines.push('');
  }

  const budgets = new Map<
    string,
    { amount: number; currency: string; tags: Map<string, number> }
  >();
  for (const budget of data.budgets.budgets) {
    if (budget.cadence !== 'monthly' || budget.tagId !== null || !('currencyCode' in budget))
      continue;
    budgets.set(budget.categoryName, {
      amount: budget.amountCents / 100,
      currency: budget.currencyCode,
      tags: new Map(budget.tagBudgets.map((tag) => [tag.tagName, tag.amountCents / 100])),
    });
  }
  for (const currency of currencies) {
    const categories = tables[currency] ?? {};
    if (!Object.keys(categories).length) continue;
    lines.push(
      `### Spend by category — ${currency}`,
      '',
      '| Category | Spend | Transactions | Budget | Variance |',
      '|---|---|---|---|---|',
    );
    for (const [category, entry] of Object.entries(categories).sort(
      (a, b) => b[1].spent - a[1].spent,
    )) {
      const budget = budgets.get(category);
      if (budget && budget.currency === currency) {
        const variance = round2(entry.spent - budget.amount);
        const description = `${variance > 0 ? 'OVER by ' : 'under by '}${money(currency, Math.abs(variance))}`;
        lines.push(
          `| ${category} | ${money(currency, entry.spent)} | ${entry.count} | ${money(currency, budget.amount)} | ${description} |`,
        );
      } else {
        lines.push(
          `| ${category} | ${money(currency, entry.spent)} | ${entry.count} | — (no stored budget) | — |`,
        );
      }
    }
    const count = Object.values(categories).reduce((sum, entry) => sum + entry.count, 0);
    lines.push(`| **Total** | **${money(currency, spent[currency] ?? 0)}** | ${count} | | |`, '');
    const foodBudget = budgets.get('Food');
    const food = categories.Food;
    if (foodBudget && foodBudget.currency === currency && food) {
      const composition = foodComposition(data.foodRows, currency);
      const verdict =
        food.spent > foodBudget.amount
          ? 'BREACH — the parent Food budget is the hard line'
          : 'within budget';
      lines.push(
        'Food composition (disjoint, Coffee > Dining Out > Groceries priority; composition only — tag budgets never ' +
          `breach on their own). Food ${money(currency, food.spent)} vs ${money(currency, foodBudget.amount)} budget: ${verdict}.`,
        '',
        '| Food tag | Spend | Tag budget |',
        '|---|---|---|',
      );
      for (const name of FOOD_TAG_PRIORITY) {
        const budget = foodBudget.tags.get(name);
        lines.push(
          `| ${name} | ${money(currency, composition[name] ?? 0)} | ${budget === undefined ? '—' : money(currency, budget)} |`,
        );
      }
      lines.push('');
    }
  }

  lines.push('## Cross-checks', '');
  for (const entry of data.monthlyStats.currencyBreakdown) {
    const currency = entry.currencyCode;
    lines.push(
      `- finance_monthly_stats (${currency}): income ${money(currency, entry.income)}, expenses ${money(currency, entry.expenses)}, ` +
        `net ${money(currency, entry.net)} — transfer-inclusive by design, so it differs from the headline ` +
        `(income ${money(currency, income[currency] ?? 0)}, spend ${money(currency, spent[currency] ?? 0)}) by the transfers and ` +
        'non-Income credits it counts. Definitional, not an error.',
    );
  }
  lines.push(...renderCacheDiff(month, tables, input.cache), '', '## Net worth', '');
  lines.push(
    'Hominem holds no historical net-worth snapshots, so no month-boundary delta is computed — any figure claiming ' +
      "one would be invented. The position is stated as labelled anchors plus the month's net cash flow (a movement " +
      'figure, not a net-worth change: balances also move via transfers, FX and plugs).',
    '',
  );
  if (!input.anchors) {
    lines.push(
      '(No monthly close anchors supplied — dated anchors and tax-status lines are not filed, so none are stated.)',
    );
  }
  for (const anchor of input.anchors?.anchors ?? []) {
    if (anchor.totals && Object.keys(anchor.totals).length) {
      const totals = Object.keys(anchor.totals)
        .sort()
        .map((currency) => `${currency} ${money(currency, anchor.totals?.[currency] ?? 0)}`)
        .join(', ');
      lines.push(`- ${anchor.date} — ${anchor.label}: ${totals}. Basis: ${anchor.basis}`);
    }
    if (anchor.blended_gbp) {
      lines.push(
        `- ${anchor.date} — ${anchor.label}: £${anchor.blended_gbp.toLocaleString('en-US')} blended. Basis: ${anchor.basis}`,
      );
    }
  }
  const worth = data.netWorth.totals
    .map(
      (total) =>
        `${total.currencyCode} ${money(total.currencyCode, total.total)} (${total.accountCount} accounts)`,
    )
    .join(', ');
  lines.push(
    `- Current at run time (${(data.netWorth.asOf || '?').slice(0, 10)}): ${worth}. Basis: finance_net_worth, per currency, unconverted.`,
  );
  lines.push(
    `- ${month} net cash flow (income − spend, plumbing excluded): ${currencies.map((currency) => `${currency} ${money(currency, net[currency] ?? 0)}`).join(', ')}.`,
    '',
    '## Tax flags',
    '',
  );
  const business = data.businessBreakdown.totalsByCurrency;
  if (business.length) {
    const total = [...business]
      .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode))
      .map((entry) => money(entry.currencyCode, entry.totalSpending))
      .join(', ');
    lines.push(`Business-tagged spend: ${total} across ${data.businessRows.length} transactions.`);
  } else {
    lines.push('Business-tagged spend: none.');
  }
  lines.push('');
  if (data.businessRows.length) {
    lines.push('| Date | Merchant | Category | Amount |', '|---|---|---|---|');
    for (const row of [...data.businessRows].sort((a, b) => a.postedOn.localeCompare(b.postedOn))) {
      lines.push(
        `| ${row.postedOn} | ${displayName(row)} | ${row.categoryName ?? 'None'} | ${money(row.currencyCode || 'UNKNOWN', Math.abs(row.amount))} |`,
      );
    }
    lines.push('');
  }
  for (const [currency, categories] of Object.entries(tables)) {
    const tax = categories['Taxes & Fees'];
    if (tax) lines.push(`Taxes & Fees category: ${money(currency, tax.spent)}.`);
  }
  if (data.incomeRows.length) {
    const sources = [...new Set(data.incomeRows.map(displayName))].sort();
    lines.push(
      `Income sources this month: ${sources.join(', ')}. Anything beyond employment and interest would be named here as ` +
        'Self-Assessment-relevant; the Business-tagged spend above is the accumulating SA record.',
    );
  }
  lines.push('');
  for (const note of input.anchors?.tax_status ?? []) lines.push(`- ${note}`);
  lines.push('', '## Uncategorized residue', '');
  const residue = data.uncatRows.filter(isSpendRow);
  const excluded = data.uncatRows.filter((row) => row.excluded).length;
  const residueTotals: Record<string, number> = {};
  for (const row of residue) {
    const currency = row.currencyCode || 'UNKNOWN';
    residueTotals[currency] = (residueTotals[currency] ?? 0) + Math.abs(row.amount);
  }
  if (residue.length) {
    const totals = Object.keys(residueTotals)
      .sort()
      .map((currency) => money(currency, round2(residueTotals[currency] ?? 0)))
      .join(', ');
    lines.push(
      `${residue.length} posted spend rows still Uncategorized at close: ${totals}.`,
      '',
      '| Date | Merchant | Amount |',
      '|---|---|---|',
    );
    for (const row of [...residue].sort((a, b) => a.postedOn.localeCompare(b.postedOn))) {
      lines.push(
        `| ${row.postedOn} | ${displayName(row)} | ${money(row.currencyCode || 'UNKNOWN', Math.abs(row.amount))} |`,
      );
    }
    lines.push('');
  } else {
    lines.push('No posted spend rows left Uncategorized — residue is zero.', '');
  }
  if (excluded) {
    lines.push(
      `(${excluded} excluded rows also sit in Uncategorized — balance plugs and account notes; excluded from ` +
        'analytics, not residue.)',
      '',
    );
  }
  if (warnings.length) {
    lines.push('## Tool warnings', '', ...warnings.map((warning) => `- ${warning}`), '');
  }
  return lines.join('\n');
}

export async function runClose(ownerUserId: string, input: FinanceWealthCloseInput) {
  const today = input.today ?? todayIso();
  const month = input.month ?? isoAddMonths(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
  const reads = createReportReads(ownerUserId, today);
  const warnings: string[] = [];
  const data = await pullMonth(reads, month, warnings);
  const md = render(month, today, input.month === undefined, data, input, warnings, reads.calls);
  const residue = data.uncatRows.filter(isSpendRow).length;
  return {
    md,
    calls: reads.calls,
    message: `month ${month}: ${reads.calls} hominem calls, ${residue} residue rows, ${warnings.length} tool warnings`,
  };
}
