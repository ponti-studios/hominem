import { PercentageProgressBar, VolumeProgressBar } from '@hominem/ui/progress';

import { cn } from '~/lib/utils';
interface SourceMetric {
  source: string;
  count: number;
  responseRate: number;
  offerRate: number;
}

interface SourcePerformanceChartProps {
  data: SourceMetric[];
}

export function SourcePerformanceChart({ data }: SourcePerformanceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 body-3 text-muted-foreground">
        No source performance data available
      </div>
    );
  }

  const maxCount = Math.max(...data.map((source) => source.count));

  return (
    <div className="space-y-4">
      {data.map((source) => (
        <div key={source.source} className="border border-border rounded-lg p-4">
          {/* Source Header */}
          <div className="flex justify-between items-center mb-3">
            <h4 className="subheading-4 text-foreground capitalize">{source.source}</h4>
            <span className="body-3 text-muted-foreground">{source.count} applications</span>
          </div>

          {/* Performance Bars */}
          <div className="space-y-3">
            <PercentageProgressBar
              label="Response Rate"
              percentage={source.responseRate}
              color="bg-accent"
            />

            <PercentageProgressBar
              label="Offer Rate"
              percentage={source.offerRate}
              color="bg-success"
            />

            <VolumeProgressBar
              label="Volume (relative)"
              count={source.count}
              maxCount={maxCount}
              color="bg-muted"
            />
          </div>

          {/* Performance Score */}
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex justify-between items-center">
              <span className="body-3 text-muted-foreground">Overall Score</span>
              <span
                className={cn(
                  'subheading-4',
                  getScoreColor(source.responseRate, source.offerRate),
                )}
              >
                {calculatePerformanceScore(source.responseRate, source.offerRate)}
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="mt-6 p-4 rounded-lg">
        <h4 className="subheading-4 text-foreground mb-2">Performance Guide</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 body-3">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-accent rounded mr-2" />
            <span className="text-muted-foreground">Response Rate</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-success rounded mr-2" />
            <span className="text-muted-foreground">Offer Rate</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-muted rounded mr-2" />
            <span className="text-muted-foreground">Application Volume</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function calculatePerformanceScore(responseRate: number, offerRate: number): string {
  const score = responseRate * 0.4 + offerRate * 0.6;

  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Improvement';
}

function getScoreColor(responseRate: number, offerRate: number): string {
  const score = responseRate * 0.4 + offerRate * 0.6;

  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-primary';
  if (score >= 40) return 'text-warning';
  return 'text-destructive';
}
