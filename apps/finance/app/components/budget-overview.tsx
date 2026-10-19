import { Spinner } from '@ponti-studios/ui/feedback';
import { Card, CardContent, CardHeader, CardTitle } from '@ponti-studios/ui/primitives';
import { Target } from 'lucide-react';
import { useMemo } from 'react';

import { useMonthlyStats } from '~/lib/hooks/use-monthly-stats';
import { useRunwaySettings } from '~/lib/hooks/use-runway-settings';
import { formatCurrency } from '~/lib/number.utils';

interface BudgetOverviewProps {
  selectedMonthYear?: string;
}

export function BudgetOverview({ selectedMonthYear }: BudgetOverviewProps) {
  const {
    data: settings,
    isLoading: isLoadingCategories,
    error: errorCategories,
  } = useRunwaySettings();

  const {
    stats: statsResult,
    isLoading: isLoadingStats,
    error: errorStats,
  } = useMonthlyStats(selectedMonthYear || '');

  const stats = statsResult || null;

  const totalBudgeted = useMemo(() => {
    return (
      settings?.budgets
        .filter((budget) => budget.currencyCode === settings.currencyCode)
        .reduce((sum, budget) => sum + budget.amount, 0) ?? 0
    );
  }, [settings]);

  const totalActual = useMemo(() => {
    if (!stats || !settings?.currencyCode) return null;
    const currencyTotal = stats.currencyBreakdown.find(
      (entry) => entry.currencyCode === settings.currencyCode,
    );
    return (
      currencyTotal?.expenses ??
      (stats.currencyCode === settings.currencyCode ? stats.expenses : null)
    );
  }, [settings, stats]);

  const variance = totalActual === null ? null : totalBudgeted - totalActual;
  const isOverBudget = variance !== null && variance < 0;

  if (isLoadingCategories || isLoadingStats) {
    return (
      <Card>
        <CardContent>
          <div className="text-center">
            <div className="mx-auto">
              <Spinner size="sm" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Loading budget data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (errorCategories || errorStats) {
    return (
      <Card>
        <CardContent className="text-center py-6">
          <h3 className="text-sm font-semibold text-foreground mb-1">Error Loading Budget Data</h3>
          <p className="text-xs text-muted-foreground">
            {errorCategories?.message || errorStats || 'An error occurred while loading data'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!settings || settings.budgets.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-6">
          <h3 className="text-sm font-semibold text-foreground mb-1">No Budget Categories</h3>
          <p className="text-xs text-muted-foreground">
            Set monthly category caps on the Runway page.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (totalBudgeted === 0) {
    return (
      <Card>
        <CardContent className="text-center py-6">
          <h3 className="text-sm font-semibold text-foreground mb-1">No Budget Set</h3>
          <p className="text-xs text-muted-foreground">
            Set budget amounts for your categories to track performance.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Target className="size-4" />
          Budget Performance {settings?.currencyCode ? `· ${settings.currencyCode}` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Budgeted</div>
            <div className="text-lg font-semibold text-foreground">
              {formatCurrency(totalBudgeted, settings?.currencyCode ?? 'USD')}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Actual</div>
            <div className="text-lg font-semibold">
              {totalActual === null
                ? 'No matching-currency activity'
                : formatCurrency(totalActual, settings?.currencyCode ?? 'USD')}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {variance === null ? 'Status' : isOverBudget ? 'Over Budget' : 'Remaining'}
            </div>
            <div className="text-lg font-semibold">
              {variance === null
                ? '—'
                : formatCurrency(Math.abs(variance), settings?.currencyCode ?? 'USD')}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
