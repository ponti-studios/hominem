import { Card, CardContent } from '@hominem/ui/card';

import type { JobApplicationMetrics } from '~/lib/career/queries/job-applications';
import type { ApplicationWithCompany } from '~/types/applications';

// SHRM 2023 / Careery 2024 benchmarks
const BENCHMARKS = {
  daysToResponse: 7,
  daysToDecision: 44,
  weeksLow: 6,
  weeksHigh: 9,
};

function getActiveInterviews(applications: ApplicationWithCompany[]) {
  return applications.filter(
    (a) =>
      a.first_interview_date &&
      a.status !== 'OFFER' &&
      a.status !== 'ACCEPTED' &&
      !['REJECTED', 'WITHDRAWN', 'CLOSED'].some((s) => a.status?.toUpperCase().includes(s)),
  ).length;
}

type TimingSource = 'personal' | 'benchmark';

interface Estimate {
  low: number;
  high: number;
  source: TimingSource;
}

function getEstimate(metrics: JobApplicationMetrics, activeInterviews: number): Estimate {
  const hasPersonalData = metrics.averageTimeToDecision > 0;

  if (hasPersonalData) {
    if (activeInterviews > 0) {
      const remainingDays = metrics.averageTimeToDecision - metrics.averageTimeToResponse;
      return {
        low: Math.max(1, Math.round(remainingDays / 7)),
        high: Math.round((remainingDays / 7) * 1.75),
        source: 'personal',
      };
    }
    return {
      low: Math.round(metrics.averageTimeToDecision / 7),
      high: Math.round((metrics.averageTimeToDecision / 7) * 2),
      source: 'personal',
    };
  }

  return {
    low: BENCHMARKS.weeksLow,
    high: BENCHMARKS.weeksHigh,
    source: 'benchmark',
  };
}

interface TimingRow {
  label: string;
  days: number;
  source: TimingSource;
}

function getTimingRows(metrics: JobApplicationMetrics): TimingRow[] {
  const hasResponseData = metrics.averageTimeToResponse > 0;
  const hasDecisionData = metrics.averageTimeToDecision > 0;

  return [
    {
      label: 'Avg. time to first response',
      days: hasResponseData ? metrics.averageTimeToResponse : BENCHMARKS.daysToResponse,
      source: hasResponseData ? 'personal' : 'benchmark',
    },
    {
      label: 'Avg. time to offer',
      days: hasDecisionData ? metrics.averageTimeToDecision : BENCHMARKS.daysToDecision,
      source: hasDecisionData ? 'personal' : 'benchmark',
    },
  ];
}

function getContext(estimate: Estimate, activeInterviews: number): string {
  if (estimate.source === 'personal') {
    if (activeInterviews > 0) {
      return `Based on ${activeInterviews} active interview${activeInterviews !== 1 ? 's' : ''} and your historical timing. Expect a decision within this range if current processes close at your usual rate.`;
    }
    return 'Based on your own application history.';
  }
  return 'Based on industry averages (SHRM 2023). This range will update as you log more applications.';
}

interface TimelineEstimateProps {
  applications: ApplicationWithCompany[];
  metrics: JobApplicationMetrics;
}

export function TimelineEstimate({ applications, metrics }: TimelineEstimateProps) {
  const activeInterviews = getActiveInterviews(applications);
  const estimate = getEstimate(metrics, activeInterviews);
  const timingRows = getTimingRows(metrics);
  const context = getContext(estimate, activeInterviews);

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <p className="ui-data-value">
          {estimate.low}–{estimate.high}
          <span className="body-3 text-muted-foreground ml-2">weeks to likely offer</span>
        </p>

        <div className="space-y-2">
          {timingRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4">
              <p className="footnote text-muted-foreground">{row.label}</p>
              <p className="footnote font-medium tabular-nums">
                {Math.round(row.days)} days
                {row.source === 'benchmark' && (
                  <span className="text-muted-foreground font-normal"> avg</span>
                )}
              </p>
            </div>
          ))}
        </div>

        <p className="footnote text-muted-foreground border-t border-border pt-4">{context}</p>
      </CardContent>
    </Card>
  );
}
