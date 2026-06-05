import { Badge } from "@hominem/ui/badge";
import { Card, CardContent } from "@hominem/ui/card";
import { EmptyState } from "@hominem/ui";
import { PercentageProgressBar } from "@hominem/ui/progress";

import type { TopCompany } from "~/lib/career/queries/job-applications";
import { cn } from "~/lib/utils";

export interface TopCompaniesInsightsProps {
  companies: TopCompany[];
}

export function TopCompaniesInsights({ companies }: TopCompaniesInsightsProps) {
  if (!companies || companies.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <EmptyState
            icon={<span className="text-2xl">🏢</span>}
            title="No company data available"
            description="Start applying to see company insights."
            variant="quiet"
            size="md"
          />
        </CardContent>
      </Card>
    );
  }

  const getRateColor = (rate: number) => {
    if (rate >= 80) return "text-emerald-600";
    if (rate >= 50) return "text-primary";
    if (rate >= 20) return "text-yellow-600";
    return "text-destructive";
  };

  const getPerformanceBadge = (offerRate: number, interviewRate: number) => {
    const avgRate = (offerRate + interviewRate) / 2;

    if (avgRate >= 70) {
      return {
        label: "Excellent",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    }

    if (avgRate >= 50) {
      return {
        label: "Good",
        className: "border-accent/30 bg-accent/10 text-primary",
      };
    }

    if (avgRate >= 30) {
      return {
        label: "Fair",
        className: "border-warning/30 bg-warning/10 text-foreground",
      };
    }

    return {
      label: "Poor",
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    };
  };

  const bestPerforming = companies.reduce((best, company) =>
    company.offerRate > best.offerRate ? company : best,
  );
  const mostApplications = companies.reduce((most, company) =>
    company.count > most.count ? company : most,
  );

  return (
    <div className="space-y-4">
      {companies.map((company) => {
        const badge = getPerformanceBadge(
          company.offerRate,
          company.interviewRate,
        );

        return (
          <Card key={company.company}>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-medium text-foreground">
                    {company.company}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {company.count} applications
                  </p>
                </div>
                <Badge variant="outline" className={badge.className}>
                  {badge.label}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <MetricStat
                  label="Interviews"
                  value={company.interviews.toString()}
                />
                <MetricStat label="Offers" value={company.offers.toString()} />
                <MetricStat
                  label="Interview Rate"
                  value={`${company.interviewRate.toFixed(0)}%`}
                  valueClassName={getRateColor(company.interviewRate)}
                />
                <MetricStat
                  label="Offer Rate"
                  value={`${company.offerRate.toFixed(0)}%`}
                  valueClassName={getRateColor(company.offerRate)}
                />
              </div>

              <div className="space-y-3">
                <PercentageProgressBar
                  label="Interview Success"
                  percentage={Math.min(company.interviewRate, 100)}
                  color="bg-accent"
                  className="rounded-lg bg-muted/30 p-3"
                />
                <PercentageProgressBar
                  label="Offer Success"
                  percentage={Math.min(company.offerRate, 100)}
                  color="bg-emerald-500"
                  className="rounded-lg bg-muted/30 p-3"
                />
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardContent className="space-y-3">
          <h4 className="font-medium text-foreground">Company Insights</h4>
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Best Performing: </span>
              <span className="font-medium text-foreground">
                {bestPerforming.company}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Most Applications: </span>
              <span className="font-medium text-foreground">
                {mostApplications.company}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-3 text-center">
      <div
        className={cn(
          "text-lg font-bold text-foreground",
          valueClassName ?? "",
        )}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
