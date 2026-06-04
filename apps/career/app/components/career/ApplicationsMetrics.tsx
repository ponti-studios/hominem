import { Badge } from '@hominem/ui/badge';
import { Button } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { useState } from 'react';

import { centsToDollars, formatPercentage } from '~/lib/utils';
import { cn } from '~/lib/utils';
import type { JobApplicationMetrics } from '~/types/career-data';
interface ApplicationsMetricsProps {
  metrics: JobApplicationMetrics;
}

export function ApplicationsMetrics({ metrics }: ApplicationsMetricsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSalaryDetails, setShowSalaryDetails] = useState(false);

  const performanceMetrics = [
    {
      title: 'Response Rate',
      value: formatPercentage(metrics.responseRate),
      icon: '📧',
      color: 'text-emerald-600',
    },
    {
      title: 'Interview Rate',
      value: formatPercentage(metrics.interviewRate),
      icon: '🎯',
      color: 'text-primary',
    },
    {
      title: 'Offer Rate',
      value: formatPercentage(metrics.offerRate),
      icon: '🎉',
      color: 'text-purple-600',
    },
    {
      title: 'Total Applications',
      value: metrics.totalApplications.toString(),
      icon: '📊',
      color: 'text-muted-foreground',
    },
  ];

  const timingMetrics = [
    {
      title: 'Avg. Response Time',
      value: `${Math.round(metrics.averageTimeToResponse)} days`,
      icon: '⏱️',
      color: 'text-indigo-600',
    },
    {
      title: 'Avg. Offer Time',
      value: `${Math.round(metrics.averageTimeToOffer)} days`,
      icon: '🕐',
      color: 'text-pink-600',
    },
    {
      title: 'Avg. Decision Time',
      value: `${Math.round(metrics.averageTimeToDecision)} days`,
      icon: '⚡',
      color: 'text-orange-600',
    },
    {
      title: 'Acceptance Rate',
      value: formatPercentage(metrics.acceptanceRate),
      icon: '✅',
      color: 'text-success',
    },
  ];

  const hasSalaryData = metrics.salaryMetrics.averageOffered > 0;

  return (
    <Card>
      <CardContent className="space-y-6 p-4">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline">Application metrics</Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {performanceMetrics.map((metric) => (
            <div key={metric.title} className="text-center">
              <div className="mb-1 text-2xl">{metric.icon}</div>
              <div className={cn('text-lg font-bold', metric.color)}>{metric.value}</div>
              <div className="text-xs text-muted-foreground">{metric.title}</div>
            </div>
          ))}
        </div>

        {isExpanded ? (
          <div className="space-y-6 border-t border-border pt-4">
            <div>
              <h3 className="mb-3 text-lg font-medium text-foreground">Timing Analysis</h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {timingMetrics.map((metric) => (
                  <div key={metric.title} className="rounded-lg bg-muted p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{metric.icon}</span>
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">{metric.title}</div>
                        <div className={cn('text-sm font-medium', metric.color)}>
                          {metric.value}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {hasSalaryData ? (
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-medium text-foreground">Salary Insights</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSalaryDetails(!showSalaryDetails)}
                  >
                    {showSalaryDetails ? 'Hide Details' : 'Show Details'}
                  </Button>
                </div>

                {showSalaryDetails ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-success/30 bg-success/10 p-4">
                      <p className="mb-1 text-sm font-medium text-muted-foreground">
                        Average Offered
                      </p>
                      <p className="text-xl font-bold text-success">
                        ${centsToDollars(metrics.salaryMetrics.averageOffered).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg border border-accent/30 bg-accent/10 p-4">
                      <p className="mb-1 text-sm font-medium text-muted-foreground">
                        Average Accepted
                      </p>
                      <p className="text-xl font-bold text-primary">
                        ${centsToDollars(metrics.salaryMetrics.averageAccepted).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                      <p className="mb-1 text-sm font-medium text-muted-foreground">
                        Negotiation Success
                      </p>
                      <p className="text-xl font-bold text-purple-700">
                        {formatPercentage(metrics.salaryMetrics.negotiationSuccessRate)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
                      <p className="mb-1 text-sm font-medium text-muted-foreground">
                        Avg. Negotiation Increase
                      </p>
                      <p className="text-xl font-bold text-foreground">
                        {formatPercentage(metrics.salaryMetrics.averageNegotiationIncrease)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-muted p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Average Salary Offered</p>
                        <p className="text-lg font-bold text-foreground">
                          ${centsToDollars(metrics.salaryMetrics.averageOffered).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Negotiation Success</p>
                        <p className="text-lg font-bold text-success">
                          {formatPercentage(metrics.salaryMetrics.negotiationSuccessRate)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
