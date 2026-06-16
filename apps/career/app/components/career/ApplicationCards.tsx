import { EmptyState } from '@hominem/ui';
import { Badge } from '@hominem/ui/badge';
import { buttonVariants } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import { CalendarIcon, DollarSignIcon, MapPinIcon } from 'lucide-react';
import { Link } from 'react-router';

import { centsToDollars, formatCurrency } from '@hominem/utils/numbers';
import { cn } from '~/lib/utils';
import { formatStatusText, getCompanyName, getStatusColor } from '~/lib/utils/applicationUtils';
import type { ApplicationWithCompany } from '~/types/applications';

interface ApplicationCardsProps {
  applications: ApplicationWithCompany[];
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function ApplicationCards({
  applications,
  emptyTitle = 'No applications found',
  emptyDescription = 'Start tracking your job applications to see them here',
  className = '',
}: ApplicationCardsProps) {
  if (!applications || applications.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        variant="quiet"
        className={className}
      />
    );
  }

  return (
    <div className={cn('grid gap-6 md:grid-cols-2 xl:grid-cols-3', className)}>
      {applications.map((app) => (
        <ApplicationCard key={app.id} application={app} />
      ))}
    </div>
  );
}

function ApplicationCard({ application }: { application: ApplicationWithCompany }) {
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '—';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const companyName = getCompanyName(application.company);

  return (
    <Card className="group border-border bg-card transition-all duration-200">
      <CardContent className="space-y-4 p-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="heading-3 text-foreground transition-colors">
                {application.position}
              </h3>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 caption1 font-semibold text-primary">
                  {companyName.charAt(0)?.toUpperCase() || 'C'}
                </div>
                <span className="truncate subheading-4 text-foreground/90">{companyName}</span>
              </div>
            </div>
            <Badge variant="outline" className={getStatusColor(application.status)}>
              {formatStatusText(application.status)}
            </Badge>
          </div>
        </div>

        <div className="space-y-3 body-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <CalendarIcon className="size-4" />
              Applied
            </span>
            <span className="subheading-4 text-foreground">
              {formatDate(application.application_date || application.start_date)}
            </span>
          </div>

          {application.location ? (
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted-foreground">
                <MapPinIcon className="size-4" />
                Location
              </span>
              <span className="max-w-32 truncate text-right subheading-4 text-foreground">
                {application.location}
              </span>
            </div>
          ) : null}

          {application.salary_quoted || application.salary_offered ? (
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted-foreground">
                <DollarSignIcon className="size-4" />
                Salary
              </span>
              <span className="max-w-32 truncate text-right subheading-4 text-foreground">
                {typeof application.salary_quoted === 'string'
                  ? application.salary_quoted
                  : application.salary_offered
                    ? formatCurrency(centsToDollars(application.salary_offered))
                    : application.salary_quoted
                      ? formatCurrency(centsToDollars(application.salary_quoted))
                      : '—'}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-border pt-2">
          <Link
            to={`/career/applications/${application.id}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            View Details
          </Link>
          {application.job_posting ? (
            <a
              href={application.job_posting}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline' })}
            >
              Job Post
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
