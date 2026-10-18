import type { AccountListOutput } from '@hominem/rpc/finance';
import { eachDayOfInterval, format, startOfMonth } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useFinanceTopMerchants } from '~/lib/hooks/use-finance-top-merchants';
import { useTimeSeriesData } from '~/lib/hooks/use-time-series';
import { formatCurrency } from '~/lib/number.utils';

type FinanceOverviewProps = {
  accounts: AccountListOutput['accounts'];
};

function formatDay(value: string) {
  const day = new Date(`${value}T12:00:00`);
  return Number.isNaN(day.getTime())
    ? value
    : day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function FinanceOverview({ accounts }: FinanceOverviewProps) {
  const [dateFrom] = useState(() => startOfMonth(new Date()));
  const [dateTo] = useState(() => new Date());
  const { data, isLoading, error } = useTimeSeriesData({
    dateFrom,
    dateTo,
    groupBy: 'day',
    includeStats: true,
    compareToPrevious: false,
  });
  const {
    data: merchants,
    isLoading: merchantsLoading,
    error: merchantsError,
  } = useFinanceTopMerchants({
    from: format(dateFrom, 'yyyy-MM-dd'),
    to: format(dateTo, 'yyyy-MM-dd'),
    limit: 5,
  });

  const stats = data?.stats;
  const metricsReady = !isLoading && !error && stats != null;
  const monthlySpending = stats?.totalExpenses ?? 0;
  const monthlyIncome = stats?.totalIncome ?? 0;
  const netCashFlow = monthlyIncome - monthlySpending;
  const merchantRows = merchants?.merchants ?? [];
  const largestMerchant = Math.max(...merchantRows.map((merchant) => merchant.totalSpent), 0);
  const chartRows = useMemo(() => {
    const spendingByDay = new Map(
      (data?.data ?? []).map((point) => [point.date, Math.abs(point.expenses)]),
    );
    let runningTotal = 0;

    return eachDayOfInterval({ start: dateFrom, end: dateTo }).map((day) => {
      const date = format(day, 'yyyy-MM-dd');
      runningTotal += spendingByDay.get(date) ?? 0;
      return { date, label: formatDay(date), total: runningTotal };
    });
  }, [data?.data, dateFrom, dateTo]);
  const monthLabel = dateTo.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <section aria-label="Monthly financial overview" className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]">
        <section
          className="rounded-xl border border-border bg-card p-5 sm:p-7"
          aria-labelledby="spending-pace-title"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="spending-pace-title" className="heading-4 text-foreground">
              Spending pace
            </h2>
            <span className="body-4 whitespace-nowrap text-muted-foreground">Month to date</span>
          </div>
          <div
            className="mt-3 h-64 sm:h-72"
            role="img"
            aria-label={`Cumulative spending for ${monthLabel}`}
          >
            {error ? (
              <p className="body-3 flex h-full items-center justify-center text-muted-foreground">
                Spending is unavailable.
              </p>
            ) : isLoading ? (
              <div className="h-full animate-pulse rounded-lg bg-muted" />
            ) : chartRows.length === 0 || monthlySpending === 0 ? (
              <p className="body-3 flex h-full items-center justify-center text-muted-foreground">
                No spending recorded this month.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartRows} margin={{ top: 12, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="finance-spending-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border-default)"
                    strokeDasharray="3 5"
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={32}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  />
                  <YAxis hide domain={[0, 'auto']} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-primary)',
                    }}
                    wrapperClassName="rounded-lg"
                    labelStyle={{ color: 'var(--text-secondary)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Spent so far"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    fill="url(#finance-spending-fill)"
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section
          className="flex flex-col rounded-xl border border-border bg-card p-5 sm:p-7"
          aria-label="Monthly totals"
        >
          <p className="body-3 text-muted-foreground">Spent in {monthLabel}</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-foreground sm:text-5xl">
            {metricsReady ? formatCurrency(monthlySpending) : '—'}
          </p>
          <dl className="mt-6 flex flex-1 flex-col justify-between divide-y divide-border border-t border-border">
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="body-3 text-muted-foreground">Income</dt>
              <dd className="text-right text-lg font-medium tabular-nums text-primary">
                {metricsReady ? formatCurrency(monthlyIncome) : '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="body-3 text-muted-foreground">Net cash flow</dt>
              <dd className="flex items-center gap-1.5 text-right text-lg font-medium tabular-nums text-foreground">
                {metricsReady ? (
                  netCashFlow >= 0 ? (
                    <ArrowUpRight className="size-4 text-success" aria-hidden />
                  ) : (
                    <ArrowDownRight className="size-4 text-destructive" aria-hidden />
                  )
                ) : null}
                {metricsReady ? formatCurrency(netCashFlow) : '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="body-3 inline-flex items-center gap-2 text-muted-foreground">
                <Wallet className="size-4 text-primary" aria-hidden />
                Accounts
              </dt>
              <dd className="text-right text-lg font-medium tabular-nums text-foreground">
                {accounts.length}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {accounts.length > 0 ? (
        <section
          className="rounded-xl border border-border bg-card p-5 sm:p-6"
          aria-labelledby="finance-accounts-title"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="finance-accounts-title" className="heading-4 text-foreground">
              Accounts
            </h2>
            <Link to="/accounts" className="body-3 text-muted-foreground hover:text-primary">
              All accounts →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {accounts.map((account) => (
              <li key={account.id}>
                <Link
                  to={`/accounts/${account.id}`}
                  className="flex items-center gap-3 py-3 hover:text-primary"
                >
                  <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {account.name}
                  </span>
                  <span
                    className="max-w-[45%] shrink-0 truncate whitespace-nowrap text-sm text-muted-foreground"
                    title={`${account.name} · ${account.accountType}`}
                  >
                    {account.name} · {account.accountType}
                  </span>
                  <span className="w-28 shrink-0 text-right tabular-nums text-foreground">
                    {formatCurrency(account.balanceCents / 100)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {merchantRows.length > 0 ? (
        <section
          className="rounded-xl border border-border bg-card p-5 sm:p-6"
          aria-labelledby="merchants-title"
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="merchants-title" className="heading-4 text-foreground">
                Top merchants
              </h2>
              <p className="body-3 mt-1 text-muted-foreground">By spending this month</p>
            </div>
          </div>
          {merchantsLoading ? (
            <div className="mt-6 space-y-5" aria-label="Loading merchants">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-8 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : merchantsError ? (
            <p className="body-3 mt-6 text-muted-foreground">Merchants are unavailable.</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {merchantRows.slice(0, 5).map((merchant) => {
                const ratio =
                  largestMerchant > 0 ? (merchant.totalSpent / largestMerchant) * 100 : 0;
                return (
                  <li key={merchant.name}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="body-3 truncate text-foreground">{merchant.name}</span>
                      <span className="body-3 shrink-0 tabular-nums text-muted-foreground">
                        {formatCurrency(merchant.totalSpent)}
                      </span>
                    </div>
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                      role="img"
                      aria-label={`${merchant.name}, ${Math.round(ratio)} percent of top merchant spend`}
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : merchantsLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-muted" aria-label="Loading merchants" />
      ) : null}
    </section>
  );
}
