import { Card, CardContent, CardHeader, CardTitle } from '@ponti-studios/ui/primitives';

import type { MonthlyStatsContract } from '~/lib/hooks/use-monthly-stats';
import { formatCurrency } from '~/lib/number.utils';

export function MonthlySummaryCard({ stats }: { stats: MonthlyStatsContract }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {stats.currencyBreakdown.length > 1 ? (
            stats.currencyBreakdown.map((currency) => (
              <div key={currency.currencyCode} className="space-y-1 border-b pb-2">
                <p className="font-medium text-sm">{currency.currencyCode}</p>
                <div className="flex items-center justify-between text-sm">
                  <span>Net</span>
                  <span
                    className={`font-bold ${currency.net >= 0 ? 'text-foreground' : 'text-destructive'}`}
                  >
                    {formatCurrency(currency.net, currency.currencyCode)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Income</span>
                  <span>{formatCurrency(currency.income, currency.currencyCode)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Expenses</span>
                  <span className="text-destructive">
                    {formatCurrency(currency.expenses, currency.currencyCode)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Net Income</span>
                <span
                  className={`font-bold ${(stats.netIncome ?? 0) >= 0 ? 'text-foreground' : 'text-destructive'}`}
                >
                  {formatCurrency(stats.netIncome ?? 0, stats.currencyCode ?? 'USD')}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total Income</span>
                <span className="text-foreground">
                  {formatCurrency(stats.totalIncome ?? 0, stats.currencyCode ?? 'USD')}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total Expenses</span>
                <span className="text-destructive">
                  {formatCurrency(stats.totalExpenses ?? 0, stats.currencyCode ?? 'USD')}
                </span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
