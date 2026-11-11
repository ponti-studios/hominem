import { EmptyState } from '@ponti-studios/ui/feedback';
import { Skeleton } from '@ponti-studios/ui/feedback';
import { SurfacePanel } from '@ponti-studios/ui/layout';
import { format } from 'date-fns';
import type { ReactNode } from 'react';

import { useTimeSeriesData } from '~/modules/finance/hooks/use-time-series';
import { formatCurrency } from '~/modules/finance/lib/number.utils';

function StatsShell({ children }: { children: ReactNode }) {
  return <SurfacePanel className="rounded-sm">{children}</SurfacePanel>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="shrink-0 text-right font-medium tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function formatDateRange(dateFrom?: Date, dateTo?: Date) {
  if (dateFrom && dateTo) {
    return `${format(dateFrom, 'MMM d, yyyy')} – ${format(dateTo, 'MMM d, yyyy')}`;
  }
  if (dateFrom) return `From ${format(dateFrom, 'MMM d, yyyy')}`;
  if (dateTo) return `Through ${format(dateTo, 'MMM d, yyyy')}`;
  return 'All time';
}

interface AnalyticsStatisticsSummaryProps {
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
  selectedAccount?: string | undefined;
  selectedTag?: string | undefined;
  includeStats?: boolean | undefined;
}

export function AnalyticsStatisticsSummary({
  dateFrom,
  dateTo,
  selectedAccount,
  selectedTag,
  includeStats = true,
}: AnalyticsStatisticsSummaryProps) {
  const {
    data: timeSeriesData,
    isLoading,
    error,
  } = useTimeSeriesData({
    dateFrom,
    dateTo,
    account: selectedAccount !== 'all' ? selectedAccount : undefined,
    tag: selectedTag || undefined,
    includeStats,
    compareToPrevious: false,
    groupBy: 'month',
  });

  const stats = timeSeriesData?.stats;

  if (!includeStats) {
    return (
      <EmptyState
        layout="inline"
        variant="quiet"
        title="Statistics disabled"
        description="Enable stats in filters to see summary data."
      />
    );
  }

  if (isLoading) {
    return (
      <StatsShell>
        <div className="px-5 py-4">
          <Skeleton className="mb-3 h-5 w-40" />
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={`stat-skeleton-${i}`} className="flex justify-between py-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </StatsShell>
    );
  }

  if (error) {
    return (
      <EmptyState
        layout="inline"
        variant="dashed"
        title="Unable to load statistics"
        description={error.message || 'Retry later.'}
      />
    );
  }

  if (!stats) {
    return (
      <EmptyState
        layout="inline"
        variant="quiet"
        title="No statistics available"
        description="Try enabling stats in filters."
      />
    );
  }

  return (
    <StatsShell>
      <div className="px-5 py-4">
        <div className="flex items-baseline justify-between gap-4 pb-2">
          <h2 className="heading-4 text-foreground">Financial summary</h2>
          <span className="text-xs text-muted-foreground">{formatDateRange(dateFrom, dateTo)}</span>
        </div>
        <div className="divide-y divide-border">
          <SummaryRow label="Total income" value={formatCurrency(stats.totalIncome ?? 0)} />
          <SummaryRow label="Total expenses" value={formatCurrency(stats.totalExpenses ?? 0)} />
          <SummaryRow label="Avg income" value={formatCurrency(stats.averageIncome ?? 0)} />
          <SummaryRow label="Avg expenses" value={formatCurrency(stats.averageExpenses ?? 0)} />
        </div>
      </div>
    </StatsShell>
  );
}
