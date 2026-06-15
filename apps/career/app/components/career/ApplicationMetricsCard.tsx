import { Card, CardContent, CardHeader, CardTitle } from '@hominem/ui/card';
import { centsToDollars, formatPercentage } from '@hominem/utils/numbers';
import { useMemo } from 'react';

import { cn } from '~/lib/utils';
import type { ApplicationWithCompany } from '~/types/applications';
import type { JobApplicationMetrics } from '~/types/career-data';

interface Metric {
  title: string;
  value: string;
  color?: string;
}

const METRIC_ROW_CLASSES =
  'flex items-baseline justify-between gap-4 border-b border-dashed border-border/60 pb-2 last:border-b-0 last:pb-0';
const METRIC_LABEL_CLASSES = 'text-xs uppercase tracking-[0.18em] text-muted-foreground';

function MetricRow({ metric }: { metric: Metric }) {
  return (
    <div className={METRIC_ROW_CLASSES}>
      <span className={METRIC_LABEL_CLASSES}>{metric.title}</span>
      <span className={cn('text-sm font-semibold', metric.color)}>{metric.value}</span>
    </div>
  );
}

interface ApplicationMetricsCardProps {
  applications: ApplicationWithCompany[];
  metrics: JobApplicationMetrics;
}

export function ApplicationMetricsCard({ applications, metrics }: ApplicationMetricsCardProps) {
  const activeDays = useMemo(() => {
    const today = new Date();
    const dates = new Set<string>();

    for (let i = 364; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      const hasApp = applications.some((app) => {
        const appDate = app.application_date || app.start_date;
        if (!appDate) return false;
        return new Date(appDate).toISOString().split('T')[0] === dateString;
      });

      if (hasApp) dates.add(dateString);
    }

    return dates.size;
  }, [applications]);

  const performanceMetrics: Metric[] = [
    {
      title: 'Applications',
      value: metrics.totalApplications.toString(),
      color: 'text-foreground',
    },
    {
      title: 'Active Days',
      value: activeDays.toString(),
      color: 'text-foreground',
    },
    {
      title: 'Response Rate',
      value: formatPercentage(metrics.responseRate),
      color: 'text-emerald-600',
    },
    {
      title: 'Interview Rate',
      value: formatPercentage(metrics.interviewRate),
      color: 'text-primary',
    },
    {
      title: 'Offer Rate',
      value: formatPercentage(metrics.offerRate),
      color: 'text-purple-600',
    },
    {
      title: 'Avg. Response Time',
      value: `${Math.round(metrics.averageTimeToResponse)} days`,
      color: 'text-foreground',
    },
  ];

  const timingMetrics: Metric[] = [
    {
      title: 'Avg. Offer Time',
      value: `${Math.round(metrics.averageTimeToOffer)} days`,
      color: 'text-pink-600',
    },
    {
      title: 'Avg. Decision Time',
      value: `${Math.round(metrics.averageTimeToDecision)} days`,
      color: 'text-orange-600',
    },
    {
      title: 'Acceptance Rate',
      value: formatPercentage(metrics.acceptanceRate),
      color: 'text-success',
    },
  ];

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">Application Metrics</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-5 font-mono text-sm">
          <div className="space-y-2">
            {performanceMetrics.map((metric) => (
              <MetricRow key={metric.title} metric={metric} />
            ))}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Timing Analysis
              </p>
              <div className="space-y-2">
                {timingMetrics.map((metric) => (
                  <MetricRow key={metric.title} metric={metric} />
                ))}
              </div>
            </div>

            <div className="space-y-3 border-t border-dashed border-border/80 pt-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Salary Insights
              </p>

              <div className="space-y-2">
                <MetricRow
                  metric={{
                    title: 'Average Offered',
                    value: `$${centsToDollars(metrics.salaryMetrics.averageOffered).toLocaleString()}`,
                    color: 'text-success',
                  }}
                />
                <MetricRow
                  metric={{
                    title: 'Average Accepted',
                    value: `$${centsToDollars(metrics.salaryMetrics.averageAccepted).toLocaleString()}`,
                    color: 'text-primary',
                  }}
                />
                <MetricRow
                  metric={{
                    title: 'Negotiation Success',
                    value: formatPercentage(metrics.salaryMetrics.negotiationSuccessRate),
                    color: 'text-purple-700',
                  }}
                />
                <MetricRow
                  metric={{
                    title: 'Avg. Negotiation Increase',
                    value: formatPercentage(metrics.salaryMetrics.averageNegotiationIncrease),
                    color: 'text-foreground',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
