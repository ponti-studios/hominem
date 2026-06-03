import { Badge } from '@hominem/ui/badge';
import { Button, buttonVariants } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@hominem/ui/select';
import { CalendarIcon, DollarSignIcon, MapPinIcon } from 'lucide-react';
import { Link, useFetcher } from 'react-router';

import { useToast } from '~/hooks/useToast';
import { centsToDollars, formatCurrency } from '~/lib/utils';
import { getCompanyName, getStatusColor } from '~/lib/utils/applicationUtils';
import type { JobApplication } from '~/types/career';
import { JobApplicationStatus } from '~/types/career';

type ApplicationWithCompany = JobApplication & {
  company?: string | { name: string; [key: string]: unknown } | null;
  applicationDate?: Date | null;
  responseDate?: Date | null;
  salaryOffered?: number | null;
  source?: string | null;
};

interface ApplicationCardsProps {
  applications: ApplicationWithCompany[];
  showActions?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function ApplicationCards({
  applications,
  showActions = false,
  emptyTitle = 'No applications found',
  emptyDescription = 'Start tracking your job applications to see them here',
  className = '',
}: ApplicationCardsProps) {
  if (!applications || applications.length === 0) {
    return (
      <div className={`py-8 text-center text-muted-foreground ${className}`}>
        <p className="font-medium text-foreground">{emptyTitle}</p>
        <p className="mt-1 text-sm">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className={`grid gap-6 md:grid-cols-2 xl:grid-cols-3 ${className}`}>
      {applications.map((app) => (
        <ApplicationCard key={app.id} application={app} showActions={showActions} />
      ))}
    </div>
  );
}

function ApplicationCard({
  application,
  showActions = false,
}: {
  application: ApplicationWithCompany;
  showActions?: boolean;
}) {
  const fetcher = useFetcher();
  const { addToast } = useToast();

  const handleStatusChange = (newStatus: string) => {
    if (!showActions) return;

    const formData = new FormData();
    formData.append('operation', 'update');
    formData.append('applicationId', application.id);
    formData.append('status', newStatus);

    fetcher.submit(formData, { method: 'POST' });
  };

  const handleDelete = () => {
    if (!showActions) return;

    if (confirm('Are you sure you want to delete this application?')) {
      const formData = new FormData();
      formData.append('operation', 'delete');
      formData.append('applicationId', application.id);

      fetcher.submit(formData, { method: 'POST' });
    }
  };

  // Handle fetcher responses
  if (fetcher.state === 'idle' && fetcher.data && showActions) {
    const result = fetcher.data as { success: boolean; error?: string; message?: string };
    if (result.success) {
      addToast(result.message || 'Application updated successfully!', 'success');
    } else {
      addToast(`Error: ${result.error}`, 'error');
    }
  }

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
    <Card className="group border-border bg-card  transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30">
      <CardContent className="space-y-4 p-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                {application.position}
              </h3>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                  {companyName.charAt(0)?.toUpperCase() || 'C'}
                </div>
                <span className="truncate font-medium text-foreground/90">{companyName}</span>
              </div>
            </div>
            <Badge variant="outline" className={getStatusColor(application.status)}>
              {application.status.replace(/_/g, ' ')}
            </Badge>
          </div>

          {showActions ? (
            <Select value={application.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(JobApplicationStatus).map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <CalendarIcon className="size-4" />
              Applied
            </span>
            <span className="font-medium text-foreground">
              {formatDate(application.applicationDate || application.startDate)}
            </span>
          </div>

          {application.location ? (
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted-foreground">
                <MapPinIcon className="size-4" />
                Location
              </span>
              <span className="max-w-32 truncate text-right font-medium text-foreground">
                {application.location}
              </span>
            </div>
          ) : null}

          {application.salaryQuoted || application.salaryOffered ? (
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted-foreground">
                <DollarSignIcon className="size-4" />
                Salary
              </span>
              <span className="max-w-32 truncate text-right font-medium text-foreground">
                {typeof application.salaryQuoted === 'string'
                  ? application.salaryQuoted
                  : application.salaryOffered
                    ? formatCurrency(centsToDollars(application.salaryOffered))
                    : application.salaryQuoted
                      ? formatCurrency(centsToDollars(application.salaryQuoted))
                      : '—'}
              </span>
            </div>
          ) : null}
        </div>

        {showActions ? (
          <div className="flex gap-2 border-t border-border pt-2">
            <Link
              to={`/job-applications/${application.id}`}
              className={buttonVariants({
                variant: 'outline',
                size: 'sm',
                className: 'h-8 flex-1 text-xs',
              })}
            >
              View Details
            </Link>
            {application.jobPosting ? (
              <a
                href={application.jobPosting}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({
                  variant: 'outline',
                  size: 'sm',
                  className: 'h-8 px-3 text-xs',
                })}
              >
                Job Post
              </a>
            ) : null}
            <Button variant="destructive" size="sm" onClick={handleDelete} className="h-8 text-xs">
              Delete
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
