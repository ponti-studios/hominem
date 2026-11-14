import type { AccountListOutput } from '@hominem/rpc/finance';
import { eachDayOfInterval, format, startOfMonth } from 'date-fns';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartCard, List, PanelState, SectionCard } from '~/components/design';
import { KeyValue, KeyValueList } from '~/components/design/key-value';
import { RowLink } from '~/components/design/lists';
import { SectionHeader } from '~/components/design/section-header';
import { AccountName } from '~/modules/finance/components/accounts/account-name';
import { useMonthlyStats } from '~/modules/finance/hooks/use-monthly-stats';
import { useTimeSeriesData } from '~/modules/finance/hooks/use-time-series';
import { formatCurrency } from '~/modules/finance/lib/number.utils';

type FinanceOverviewProps = {
  accounts: AccountListOutput['accounts'];
};

function formatDay(value: string) {
  const day = new Date(`${value}T12:00:00`);
  return Number.isNaN(day.getTime())
    ? value
    : day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatAccountBalance(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function FinanceOverview({ accounts }: FinanceOverviewProps) {
  const [dateFrom] = useState(() => startOfMonth(new Date()));
  const [dateTo] = useState(() => new Date());
  const {
    stats: monthlyStats,
    isLoading: monthlyStatsLoading,
    error: monthlyStatsError,
  } = useMonthlyStats(format(dateTo, 'yyyy-MM'));
  const { data, isLoading, error } = useTimeSeriesData({
    dateFrom,
    dateTo,
    groupBy: 'day',
    includeStats: true,
    compareToPrevious: false,
  });
  const currencyRows = monthlyStats?.currencyBreakdown ?? [];
  const metricsReady = !monthlyStatsLoading && !monthlyStatsError && monthlyStats != null;
  const chartCurrency = currencyRows.length === 1 ? currencyRows[0]?.currencyCode : null;
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
  return (
    <section aria-label="Monthly financial overview" className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]">
        <ChartCard
          title="Spending pace"
          subtitle="Month to date"
          height="md"
          labelledBy="spending-pace-title"
          state={
            error || monthlyStatsError
              ? 'error'
              : isLoading || monthlyStatsLoading
                ? 'loading'
                : currencyRows.length > 1 ||
                    chartRows.length === 0 ||
                    (currencyRows[0]?.expenses ?? 0) === 0
                  ? 'empty'
                  : 'ready'
          }
          errorTitle="Spending unavailable"
          emptyTitle={
            currencyRows.length > 1 ? 'Multiple currencies' : 'No spending recorded this month'
          }
          emptyDescription={
            currencyRows.length > 1
              ? 'Spending spans multiple currencies. See the currency totals for separate amounts.'
              : undefined
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartRows} margin={{ top: 12, right: 4, bottom: 0, left: 0 }}>
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
                formatter={(value) => formatCurrency(Number(value), chartCurrency ?? 'USD')}
                contentStyle={{
                  backgroundColor: 'var(--popover)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                  borderRadius: '2px',
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
                fill="var(--primary)"
                fillOpacity={0.1}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <SectionCard index={1} className="flex flex-col p-5 sm:p-7">
          {currencyRows.length > 1 ? (
            <p className="text-[13px] text-muted-foreground">Monthly totals by currency</p>
          ) : null}
          <KeyValueList className={currencyRows.length === 1 ? 'mt-0 justify-start' : undefined}>
            {currencyRows.length > 1 ? (
              currencyRows.map((currency) => (
                <div key={currency.currencyCode} className="py-4">
                  <dt className="mb-2 text-[13px] font-medium text-foreground">
                    {currency.currencyCode}
                  </dt>
                  <dd className="grid grid-cols-3 gap-2 text-right text-sm text-foreground tabular-nums">
                    <span>
                      <span className="block text-xs text-muted-foreground">Spent</span>
                      {formatCurrency(currency.expenses, currency.currencyCode)}
                    </span>
                    <span>
                      <span className="block text-xs text-muted-foreground">Income</span>
                      {formatCurrency(currency.income, currency.currencyCode)}
                    </span>
                    <span>
                      <span className="block text-xs text-muted-foreground">Net</span>
                      {formatCurrency(currency.net, currency.currencyCode)}
                    </span>
                  </dd>
                </div>
              ))
            ) : currencyRows.length === 1 ? (
              <>
                <KeyValue
                  label="Income"
                  tone="default"
                  value={
                    metricsReady
                      ? formatCurrency(currencyRows[0]?.income ?? 0, currencyRows[0]?.currencyCode)
                      : '—'
                  }
                />
                <KeyValue
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      Net cash flow
                      {metricsReady ? (
                        (currencyRows[0]?.net ?? 0) >= 0 ? (
                          <ArrowUpRight className="size-4 text-success-text" aria-hidden />
                        ) : (
                          <ArrowDownRight className="size-4 text-destructive-text" aria-hidden />
                        )
                      ) : null}
                    </span>
                  }
                  value={
                    metricsReady
                      ? formatCurrency(currencyRows[0]?.net ?? 0, currencyRows[0]?.currencyCode)
                      : '—'
                  }
                />
              </>
            ) : (
              <PanelState
                title={monthlyStatsError ? 'Monthly totals unavailable' : 'No activity this month'}
              />
            )}
          </KeyValueList>
        </SectionCard>
      </div>

      {accounts.length > 0 ? (
        <SectionCard index={2}>
          <div>
            <SectionHeader
              title="Accounts"
              actionLabel="All accounts"
              actionTo="/finance/accounts"
            />
            <div className="mt-3">
              <List.Items ariaLabel="Accounts">
                {accounts.map((account) => (
                  <li key={account.id}>
                    <RowLink
                      to={`/finance/accounts/${account.id}`}
                      title={<AccountName name={account.name} type={account.accountType} />}
                      trailing={
                        <span className="w-28 shrink-0 text-right text-foreground">
                          {formatAccountBalance(account.balanceCents / 100, account.currencyCode)}
                        </span>
                      }
                    />
                  </li>
                ))}
              </List.Items>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </section>
  );
}
