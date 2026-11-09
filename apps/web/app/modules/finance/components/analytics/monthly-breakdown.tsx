import type { TimeSeriesDataPoint } from '@hominem/rpc/finance';
import { Link, useNavigate } from 'react-router';

import { BlockSkeleton, PanelState } from '~/components/design';
import { DataTable } from '~/components/design/data-table';
import { SectionHeader } from '~/components/design/section-header';
import { SectionCard } from '~/components/design/surfaces';
import { cn } from '~/lib/utils';
import { useTimeSeriesData } from '~/modules/finance/hooks/use-time-series';
import { formatCurrency } from '~/modules/finance/lib/number.utils';

interface MonthlyBreakdownProps {
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
  selectedAccount?: string | undefined;
  selectedTag?: string | undefined;
  compareToPrevious?: boolean | undefined;
  groupBy?: 'month' | 'week' | 'day' | undefined;
  title: string;
}

const DeltaIcon = ({ delta }: { delta: number }) => {
  if (delta > 0)
    return (
      <span className="text-destructive mr-1" title="Increase">
        ▲
      </span>
    );
  if (delta < 0)
    return (
      <span className="text-foreground mr-1" title="Decrease">
        ▼
      </span>
    );
  return <span className="text-muted-foreground mr-1">–</span>;
};

function TrendsDelta({
  label,
  prevDate,
  currDate,
  delta,
  formatDateLabel,
  formatCurrency,
}: {
  label: string;
  prevDate: string;
  currDate: string;
  delta: number;
  formatDateLabel: (dateStr: string) => string;
  formatCurrency: (n: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {formatDateLabel(prevDate)} → {formatDateLabel(currDate)}
        </span>
      </div>
      <div className="flex items-center text-lg font-mono">
        <DeltaIcon delta={delta} />
        <span
          className={
            delta > 0 ? 'text-destructive' : delta < 0 ? 'text-foreground' : 'text-muted-foreground'
          }
        >
          {formatCurrency(Math.abs(delta))}
        </span>
      </div>
    </div>
  );
}

function TrendsContent({
  prevMonth,
  currMonth,
  formatDateLabel,
  formatCurrency,
}: {
  prevMonth: TimeSeriesDataPoint;
  currMonth: TimeSeriesDataPoint;
  formatDateLabel: (dateStr: string) => string;
  formatCurrency: (n: number) => string;
}) {
  const expensesDelta = (currMonth.expenses ?? 0) - (prevMonth.expenses ?? 0);
  return (
    <div className="border p-4 mb-4">
      <div className="grid grid-cols-1 gap-4">
        <TrendsDelta
          label="Largest spending change"
          prevDate={prevMonth.date}
          currDate={currMonth.date}
          delta={expensesDelta}
          formatDateLabel={formatDateLabel}
          formatCurrency={formatCurrency}
        />
      </div>
    </div>
  );
}

interface MonthItemProps {
  item: TimeSeriesDataPoint;
  compareToPrevious: boolean;
  formatDateLabel: (dateStr: string) => string;
  selectedTag: string | undefined;
}

function MonthMobileItem({
  item,
  compareToPrevious,
  formatDateLabel,
  selectedTag,
}: MonthItemProps) {
  const navigate = useNavigate();

  const monthlyAnalyticsUrl = selectedTag
    ? `/finance/analytics/monthly/${item.date}?tag=${encodeURIComponent(selectedTag)}`
    : `/finance/analytics/monthly/${item.date}`;

  return (
    <button
      type="button"
      className="w-full text-left  border p-4  focus:outline-none focus:ring-2 focus:ring-primary"
      onClick={() => navigate(monthlyAnalyticsUrl)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') navigate(monthlyAnalyticsUrl);
      }}
      aria-label={`View details for ${formatDateLabel(item.date)}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm text-muted-foreground">
          {formatDateLabel(item.date)}
        </span>
        <Link
          to={monthlyAnalyticsUrl}
          className="text-primary underline text-xs ml-2"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          Details
        </Link>
      </div>
      <div className="flex flex-wrap gap-y-1 text-sm">
        <div className="flex justify-between w-full">
          Transactions: <span className="font-mono">{item.count}</span>
        </div>
        <div className="flex justify-between w-full">
          Total Spent: <span className="font-mono">{formatCurrency(Math.abs(item.expenses))}</span>
        </div>
        <div className="flex justify-between w-full">
          Average: <span className="font-mono">{formatCurrency(Math.abs(item.average))}</span>
        </div>
        {compareToPrevious && (
          <div className="flex justify-between w-full">
            Spending Trend:{' '}
            <span
              className={cn('font-mono', {
                'text-destructive': item.trend?.directionExpenses === 'up',
                'text-foreground': item.trend?.directionExpenses === 'down',
              })}
            >
              {item.trend
                ? `${item.trend.directionExpenses === 'up' ? '+' : '-'}${item.trend.percentChangeExpenses}%`
                : '-'}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

export function MonthlyBreakdown({
  dateFrom,
  dateTo,
  selectedAccount,
  selectedTag,
  compareToPrevious = false,
  groupBy = 'month',
  title,
}: MonthlyBreakdownProps) {
  const navigate = useNavigate();
  const { data, isLoading, error, formatDateLabel } = useTimeSeriesData({
    dateFrom,
    dateTo,
    account: selectedAccount,
    tag: selectedTag,
    compareToPrevious,
    groupBy,
  });

  if (isLoading) {
    return (
      <SectionCard>
        <div className="flex flex-col gap-2 p-5">
          <BlockSkeleton className="h-6 w-48" label="Loading breakdown" />
          <BlockSkeleton label="Loading breakdown" />
          <BlockSkeleton label="Loading breakdown" />
          <BlockSkeleton label="Loading breakdown" />
        </div>
      </SectionCard>
    );
  }

  if (error || !Array.isArray(data?.data) || data.data.length === 0) {
    return (
      <PanelState
        title={error ? 'Breakdown unavailable' : 'No data available for the selected period'}
      />
    );
  }

  const sortedData = [...data.data].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const showTrends = compareToPrevious && sortedData.length >= 2;
  const prevMonth = showTrends ? sortedData[1] : null;
  const currMonth = showTrends ? sortedData[0] : null;

  const monthlyUrl = (date: string) =>
    selectedTag
      ? `/finance/analytics/monthly/${date}?tag=${encodeURIComponent(selectedTag)}`
      : `/finance/analytics/monthly/${date}`;

  return (
    <SectionCard>
      <div className="p-5 sm:p-6">
        <SectionHeader
          title={title}
          description={selectedTag ? `Filtered by: ${selectedTag}` : undefined}
        />

        {showTrends && prevMonth && currMonth && (
          <div className="mt-4">
            <TrendsContent
              prevMonth={prevMonth}
              currMonth={currMonth}
              formatDateLabel={formatDateLabel}
              formatCurrency={formatCurrency}
            />
          </div>
        )}

        {/* Desktop Table */}
        <div className="mt-4 hidden md:block">
          <DataTable
            ariaLabel={title}
            rows={sortedData}
            keyOf={(item) => item.date}
            onRowClick={(item) => navigate(monthlyUrl(item.date))}
            rowLabel={(item) => `View details for ${formatDateLabel(item.date)}`}
            columns={[
              { key: 'period', header: 'Period', render: (item) => formatDateLabel(item.date) },
              {
                key: 'count',
                header: 'Transactions',
                align: 'right',
                render: (item) => String(item.count),
              },
              {
                key: 'spent',
                header: 'Total Spent',
                align: 'right',
                render: (item) => formatCurrency(Math.abs(item.expenses)),
              },
              {
                key: 'avg',
                header: 'Average',
                align: 'right',
                render: (item) => formatCurrency(Math.abs(item.average)),
              },
              ...(compareToPrevious
                ? [
                    {
                      key: 'trend',
                      header: 'Trend',
                      align: 'right' as const,
                      render: (item: TimeSeriesDataPoint) => (
                        <span
                          className={cn({
                            'text-[#ff9d9d]': item.trend?.directionExpenses === 'up',
                            'text-[#f2f4f8]': item.trend?.directionExpenses === 'down',
                          })}
                        >
                          {item.trend
                            ? `${item.trend.directionExpenses === 'up' ? '+' : '-'}${item.trend.percentChangeExpenses}%`
                            : '-'}
                        </span>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </div>

        {/* Mobile Cards */}
        <div className="mt-4 flex flex-col gap-3 md:hidden">
          {sortedData.map((item) => (
            <MonthMobileItem
              key={item.date}
              item={item}
              compareToPrevious={compareToPrevious}
              formatDateLabel={formatDateLabel}
              selectedTag={selectedTag}
            />
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
