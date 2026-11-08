import type { AccountListOutput } from '@hominem/rpc/finance';
import { eachDayOfInterval, format, startOfMonth } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
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

import { ChartCard, PanelState, SectionCard } from '~/components/design';
import { KeyValue, KeyValueList } from '~/components/design/key-value';
import { List, RowLink } from '~/components/design/lists';
import { Meter } from '~/components/design/meter';
import { SectionHeader } from '~/components/design/section-header';
import { BlockSkeleton } from '~/components/design/skeleton';
import { useFinanceTopMerchants } from '~/modules/finance/hooks/use-finance-top-merchants';
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
  const {
    data: merchants,
    isLoading: merchantsLoading,
    error: merchantsError,
  } = useFinanceTopMerchants({
    from: format(dateFrom, 'yyyy-MM-dd'),
    to: format(dateTo, 'yyyy-MM-dd'),
    limit: 5,
  });

  const currencyRows = monthlyStats?.currencyBreakdown ?? [];
  const metricsReady = !monthlyStatsLoading && !monthlyStatsError && monthlyStats != null;
  const chartCurrency = currencyRows.length === 1 ? currencyRows[0]?.currencyCode : null;
  const merchantRows = merchants?.merchants ?? [];
  const largestMerchantByCurrency = new Map<string, number>();
  for (const merchant of merchantRows) {
    largestMerchantByCurrency.set(
      merchant.currencyCode,
      Math.max(largestMerchantByCurrency.get(merchant.currencyCode) ?? 0, merchant.totalSpent),
    );
  }
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
              <defs>
                <linearGradient id="finance-spending-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d7ff3e" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#d7ff3e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="3 5"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                minTickGap={32}
                tick={{ fill: '#9ba3b4', fontSize: 11 }}
              />
              <YAxis hide domain={[0, 'auto']} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value), chartCurrency ?? 'USD')}
                contentStyle={{
                  backgroundColor: '#12161d',
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: '#f2f4f8',
                  borderRadius: '12px',
                }}
                wrapperClassName="rounded-lg"
                labelStyle={{ color: '#9ba3b4' }}
              />
              <Area
                type="monotone"
                dataKey="total"
                name="Spent so far"
                stroke="#d7ff3e"
                strokeWidth={2.5}
                fill="url(#finance-spending-fill)"
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <SectionCard index={1} className="flex flex-col p-5 sm:p-7">
          <p className="text-[13px] text-[#9ba3b4]">
            {currencyRows.length > 1 ? 'Monthly totals by currency' : `Spent in ${monthLabel}`}
          </p>
          {currencyRows.length === 1 ? (
            <p
              className="mt-1 text-4xl font-semibold text-[#f2f4f8] tabular-nums sm:text-5xl"
              style={{ letterSpacing: '-0.03em' }}
            >
              {metricsReady
                ? formatCurrency(currencyRows[0]?.expenses ?? 0, currencyRows[0]?.currencyCode)
                : '—'}
            </p>
          ) : null}
          <KeyValueList>
            {currencyRows.length > 1 ? (
              currencyRows.map((currency) => (
                <div key={currency.currencyCode} className="py-4">
                  <dt className="mb-2 text-[13px] font-medium text-[#d7ff3e]">
                    {currency.currencyCode}
                  </dt>
                  <dd className="grid grid-cols-3 gap-2 text-right text-sm text-[#f2f4f8] tabular-nums">
                    <span>
                      <span className="block text-xs text-[#9ba3b4]">Spent</span>
                      {formatCurrency(currency.expenses, currency.currencyCode)}
                    </span>
                    <span>
                      <span className="block text-xs text-[#9ba3b4]">Income</span>
                      {formatCurrency(currency.income, currency.currencyCode)}
                    </span>
                    <span>
                      <span className="block text-xs text-[#9ba3b4]">Net</span>
                      {formatCurrency(currency.net, currency.currencyCode)}
                    </span>
                  </dd>
                </div>
              ))
            ) : currencyRows.length === 1 ? (
              <>
                <KeyValue
                  label="Income"
                  tone="volt"
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
                          <ArrowUpRight className="size-4 text-[#4ade80]" aria-hidden />
                        ) : (
                          <ArrowDownRight className="size-4 text-[#ff6b6b]" aria-hidden />
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
            <KeyValue
              label={
                <span className="inline-flex items-center gap-2">
                  <Wallet className="size-4 text-[#d7ff3e]" aria-hidden />
                  Accounts
                </span>
              }
              value={String(accounts.length)}
            />
          </KeyValueList>
        </SectionCard>
      </div>

      {accounts.length > 0 ? (
        <SectionCard index={2}>
          <div className="p-5 sm:p-6">
            <SectionHeader
              title="Accounts"
              actionLabel="All accounts"
              actionTo="/finance/accounts"
            />
            <div className="mt-3">
              <List ariaLabel="Accounts">
                {accounts.map((account) => (
                  <li key={account.id}>
                    <RowLink
                      to={`/finance/accounts/${account.id}`}
                      title={account.name}
                      leading={
                        <span className="size-2 shrink-0 rounded-full bg-[#d7ff3e]" aria-hidden />
                      }
                      meta={
                        <span
                          className="max-w-[45%] shrink-0 truncate whitespace-nowrap"
                          title={`${account.name} · ${account.accountType}`}
                        >
                          {account.name} · {account.accountType}
                        </span>
                      }
                      trailing={
                        <span className="w-28 shrink-0 text-right text-[#f2f4f8]">
                          {formatCurrency(account.balanceCents / 100, account.currencyCode)}
                        </span>
                      }
                    />
                  </li>
                ))}
              </List>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {merchantRows.length > 0 ? (
        <SectionCard index={3}>
          <div className="p-5 sm:p-6">
            <SectionHeader title="Top merchants" description="By spending this month" />
            {merchantsLoading ? (
              <div
                className="mt-6 flex flex-col gap-5"
                role="status"
                aria-label="Loading merchants"
              >
                <BlockSkeleton className="h-8 rounded bg-white/[0.04]" />
                <BlockSkeleton className="h-8 rounded bg-white/[0.04]" />
                <BlockSkeleton className="h-8 rounded bg-white/[0.04]" />
              </div>
            ) : merchantsError ? (
              <div className="mt-4">
                <PanelState title="Merchants unavailable" />
              </div>
            ) : (
              <ul className="mt-5 space-y-4">
                {merchantRows.slice(0, 5).map((merchant) => {
                  const largestMerchant = largestMerchantByCurrency.get(merchant.currencyCode) ?? 0;
                  const ratio =
                    largestMerchant > 0 ? (merchant.totalSpent / largestMerchant) * 100 : 0;
                  return (
                    <li key={`${merchant.currencyCode}:${merchant.name}`}>
                      <Meter
                        label={merchant.name}
                        valueLabel={formatCurrency(merchant.totalSpent, merchant.currencyCode)}
                        percent={ratio}
                        description="of top merchant spend"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </SectionCard>
      ) : merchantsLoading ? (
        <BlockSkeleton label="Loading merchants" />
      ) : null}
    </section>
  );
}
