import type { TimeSeriesDataPoint } from '@hominem/rpc/finance';
import { formatMonthYear } from '@hominem/utils/dates';
import { Skeleton } from '@ponti-studios/ui/feedback';
import { Button } from '@ponti-studios/ui/primitives';
import { Card, CardContent } from '@ponti-studios/ui/primitives';
import type { Dispatch, SetStateAction } from 'react';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CardHeader } from '~/components/design';
import { useTimeSeriesData } from '~/modules/finance/hooks/use-time-series';
import { formatCurrency } from '~/modules/finance/lib/number.utils';

interface AnalyticsChartDisplayProps {
  chartType: 'area' | 'bar';
  setChartType: Dispatch<SetStateAction<'area' | 'bar'>>;
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
  selectedAccount?: string | undefined;
  selectedTag?: string | undefined;
  groupBy?: 'month' | 'week' | 'day' | undefined;
  compareToPrevious?: boolean | undefined;
}

export function AnalyticsChartDisplay({
  chartType,
  setChartType,
  dateFrom,
  dateTo,
  selectedAccount,
  selectedTag,
  groupBy = 'month',
  compareToPrevious = false,
}: AnalyticsChartDisplayProps) {
  const {
    data: timeSeriesData,
    isLoading,
    error,
  } = useTimeSeriesData({
    dateFrom,
    dateTo,
    account: selectedAccount !== 'all' ? selectedAccount : undefined,
    tag: selectedTag || undefined,
    includeStats: false,
    compareToPrevious,
    groupBy,
  });

  const incomeExpensesChartData = useMemo(() => {
    if (!Array.isArray(timeSeriesData?.data)) {
      return [];
    }
    return timeSeriesData.data.map((point: TimeSeriesDataPoint) => ({
      name: formatMonthYear(point.date),
      Income: point.income,
      Expenses: Math.abs(point.expenses),
    }));
  }, [timeSeriesData]);

  if (isLoading) {
    return (
      <Card className="gap-0">
        <CardHeader
          title="Trends"
          action={
            <>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </>
          }
        />
        <CardContent className="pt-0">
          <div className="h-80 w-full max-w-full">
            <Skeleton className="h-full w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="gap-0">
        <CardHeader title="Trends" />
        <CardContent className="pt-0">
          <div className="h-80 w-full max-w-full flex items-center justify-center">
            <div className="text-center text-destructive">
              {error.message || 'Unable to load chart data. Retry later.'}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!incomeExpensesChartData.length) {
    return (
      <Card className="gap-0">
        <CardHeader title="Trends" />
        <CardContent className="pt-0">
          <div className="h-80 w-full max-w-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              No data available for the selected period
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="gap-0">
        <CardHeader
          title="Trends"
          action={
            <>
              <Button
                variant={chartType === 'area' ? 'default' : 'outline'}
                onClick={() => setChartType('area')}
                size="sm"
              >
                Area
              </Button>
              <Button
                variant={chartType === 'bar' ? 'default' : 'outline'}
                onClick={() => setChartType('bar')}
                size="sm"
              >
                Bar
              </Button>
            </>
          }
        />
        <CardContent className="pt-0">
          <div className="h-80 w-full max-w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart
                  data={incomeExpensesChartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  />
                  <YAxis
                    className="text-xs"
                    tickFormatter={(value) => formatCurrency(value)}
                    width={80}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  />
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border-default)"
                    strokeDasharray="3 5"
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-primary)',
                    }}
                    labelStyle={{ color: 'var(--text-secondary)' }}
                  />
                  <Legend wrapperStyle={{ color: 'var(--text-secondary)' }} />
                  <Area
                    type="monotone"
                    dataKey="Income"
                    stroke="var(--success)"
                    strokeWidth={2}
                    fill="var(--success)"
                    fillOpacity={0.1}
                  />
                  <Area
                    type="monotone"
                    dataKey="Expenses"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="var(--primary)"
                    fillOpacity={0.1}
                  />
                </AreaChart>
              ) : (
                <BarChart
                  data={incomeExpensesChartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(value) => formatCurrency(value)}
                    width={80}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  />
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border-default)"
                    strokeDasharray="3 5"
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-primary)',
                    }}
                    labelStyle={{ color: 'var(--text-secondary)' }}
                  />
                  <Legend wrapperStyle={{ color: 'var(--text-secondary)' }} />
                  <Bar dataKey="Income" fill="var(--success)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
