import type { TimeSeriesDataPoint } from '@hominem/rpc/finance';
import { Button } from '@ponti-studios/ui/primitives';
import { Card, CardContent, CardHeader, CardTitle } from '@ponti-studios/ui/primitives';
import { colorThemes } from '@ponti-studios/ui/tokens';
import { subMonths } from 'date-fns';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useTimeSeriesData } from '~/modules/finance/hooks/use-time-series';
import { formatCurrency } from '~/modules/finance/lib/number.utils';

const colors = colorThemes.light;
const SPENDING_COLOR = colors.destructive;

interface AccountSpendingChartProps {
  accountId: string;
  accountName: string;
}

export function AccountSpendingChart({ accountId, accountName }: AccountSpendingChartProps) {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  // memoized so this doesn't trigger a re-render loop every render
  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    return {
      dateFrom: subMonths(now, 6),
      dateTo: now,
    };
  }, []);

  const {
    data: timeSeriesData,
    isLoading,
    error,
    formatDateLabel,
  } = useTimeSeriesData({
    dateFrom,
    dateTo,
    account: accountId,
    includeStats: false,
    compareToPrevious: false,
    groupBy: 'month',
    enabled: !!accountId,
  });

  const chartData = useMemo(() => {
    if (!Array.isArray(timeSeriesData?.data)) return [];
    return timeSeriesData.data.map((point: TimeSeriesDataPoint) => ({
      name: formatDateLabel(point.date),
      Spending: Math.abs(point.expenses),
    }));
  }, [timeSeriesData, formatDateLabel]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full flex items-center justify-center">
            <div className="text-muted-foreground">Loading chart...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    console.error('AccountSpendingChart error:', error);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full flex items-center justify-center">
            <div className="text-destructive">
              Failed to load chart data
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs mt-2 text-muted-foreground">Error: {error.message}</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full flex items-center justify-center">
            <div className="text-muted-foreground">No spending data available</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
            <span>Monthly Spending - {accountName}</span>
            <div className="flex items-center space-x-2">
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
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full max-w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} width={80} />
                <CartesianGrid strokeDasharray="3 3" />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), 'Spending']}
                  labelStyle={{ color: colors['text-primary'] }}
                />
                <Area
                  type="monotone"
                  dataKey="Spending"
                  stroke={SPENDING_COLOR}
                  fillOpacity={0.1}
                  fill={SPENDING_COLOR}
                />
              </AreaChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} width={80} />
                <CartesianGrid strokeDasharray="3 3" />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), 'Spending']}
                  labelStyle={{ color: colors['text-primary'] }}
                />
                <Bar dataKey="Spending" fill={SPENDING_COLOR} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
