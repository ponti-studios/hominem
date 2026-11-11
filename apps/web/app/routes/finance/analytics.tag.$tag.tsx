import { subMonths } from 'date-fns';
import { useState } from 'react';
import { useParams } from 'react-router';

import { PageHeader } from '~/components/design';
import { AccountSelect } from '~/modules/finance/components/account-select';
import { AnalyticsChartDisplay } from '~/modules/finance/components/analytics/analytics-chart-display';
import { MonthlyBreakdown } from '~/modules/finance/components/analytics/monthly-breakdown';

export default function TagAnalyticsPage() {
  const { tag } = useParams<{ tag: string }>();
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [dateFrom, _setDateFrom] = useState<Date>(subMonths(new Date(), 6));
  const [dateTo] = useState<Date>(new Date());
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  return (
    <div className="container">
      <PageHeader
        eyebrow="Finance · Analytics"
        title={`Tag analysis: ${tag}`}
        actions={
          <AccountSelect
            selectedAccount={selectedAccount}
            setSelectedAccount={setSelectedAccount}
          />
        }
      />

      <div className="space-y-6">
        <AnalyticsChartDisplay
          chartType={chartType}
          setChartType={setChartType}
          dateFrom={dateFrom}
          dateTo={dateTo}
          selectedAccount={selectedAccount}
          selectedTag={tag}
          groupBy="month"
          compareToPrevious={true}
        />

        <MonthlyBreakdown
          title="Monthly Breakdown"
          dateFrom={dateFrom}
          dateTo={dateTo}
          selectedAccount={selectedAccount}
          selectedTag={tag}
          compareToPrevious={true}
          groupBy="month"
        />
      </div>
    </div>
  );
}
