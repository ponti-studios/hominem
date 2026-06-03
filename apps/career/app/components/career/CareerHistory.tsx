import { Badge } from '@hominem/ui/badge';
import { buttonVariants } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import { BriefcaseIcon, ChevronRightIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Link } from 'react-router';

import { formatCurrency, formatPercentage } from '~/lib/utils';
import type { WorkExperienceWithFinancials } from '~/types/career-data';

interface CareerHistoryProps {
  workExperiences: WorkExperienceWithFinancials[];
}

export function CareerHistory({ workExperiences }: CareerHistoryProps) {
  const sortedExperiences = workExperiences
    .filter((experience) => experience.startDate)
    .sort((a, b) => {
      const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
      const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
      return dateB - dateA;
    });

  const formatDuration = (startDate: string | Date, endDate?: string | Date | null) => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const years = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    if (years < 1) {
      const months = Math.round(years * 12);
      return `${months} month${months !== 1 ? 's' : ''}`;
    }

    const wholeYears = Math.floor(years);
    const remainingMonths = Math.round((years - wholeYears) * 12);

    if (remainingMonths === 0) {
      return `${wholeYears} year${wholeYears !== 1 ? 's' : ''}`;
    }

    return `${wholeYears}y ${remainingMonths}m`;
  };

  const formatDateRange = (startDate: string | Date, endDate?: string | Date | null) => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;

    const startFormatted = start.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });

    const endFormatted = end
      ? end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : 'Present';

    return `${startFormatted} - ${endFormatted}`;
  };

  if (sortedExperiences.length === 0) {
    return (
      <Card data-testid="career-history">
        <CardContent className="py-12 text-center" data-testid="empty-state">
          <div className="mb-4 text-muted-foreground">
            <BriefcaseIcon className="mx-auto h-16 w-16" />
          </div>
          <p className="font-medium text-foreground" data-testid="empty-message">
            No work experience yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="empty-description">
            Add your work experiences to see your career journey
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div data-testid="career-history" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2
            className="text-2xl font-semibold text-foreground"
            data-testid="work-experience-title"
          >
            Work Experience
          </h2>
          <p className="text-sm text-muted-foreground">
            Track your roles, growth, and compensation over time.
          </p>
        </div>
        <Badge variant="outline" data-testid="position-count">
          {sortedExperiences.length} position{sortedExperiences.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="hidden space-y-3 md:block" data-testid="work-experience-list">
        {sortedExperiences.map((experience) => (
          <Card
            key={experience.id}
            className="transition-colors hover:border-primary/30"
            data-testid={`work-experience-${experience.id}`}
          >
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground" data-testid="job-title">
                      {experience.role}
                    </h3>
                    <Link
                      to={`/career/experience/${experience.id}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      View Details
                    </Link>
                    {!experience.endDate ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                        data-testid="current-badge"
                      >
                        Current
                      </Badge>
                    ) : null}
                  </div>

                  <p className="text-sm text-muted-foreground" data-testid="company-name">
                    {experience.company}
                  </p>

                  {experience.metrics ? (
                    <p className="text-sm text-muted-foreground" data-testid="job-metrics">
                      {experience.metrics}
                    </p>
                  ) : null}
                </div>

                <div
                  className="flex items-center gap-1 text-sm text-muted-foreground"
                  data-testid="employment-dates"
                >
                  {experience.startDate ? (
                    <>
                      <span data-testid="date-range">
                        {formatDateRange(experience.startDate, experience.endDate)}
                      </span>
                      <span>•</span>
                      <span data-testid="duration">
                        {formatDuration(experience.startDate, experience.endDate)}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="key-stats">
                {experience.currentAnnualizedSalary ? (
                  <KeyStat
                    data-testid="salary-stat"
                    label="Salary"
                    value={formatCurrency(experience.currentAnnualizedSalary / 100)}
                  />
                ) : null}

                {experience.promotionCount !== undefined && experience.promotionCount > 0 ? (
                  <KeyStat
                    data-testid="promotion-stat"
                    label="Promotions"
                    value={experience.promotionCount.toString()}
                  />
                ) : null}

                {experience.averageAnnualRaise && experience.averageAnnualRaise > 0 ? (
                  <KeyStat
                    data-testid="raise-stat"
                    label="Avg. Raise"
                    value={formatPercentage(experience.averageAnnualRaise)}
                  />
                ) : null}

                {experience.totalCompensationReceived &&
                experience.totalCompensationReceived > 0 ? (
                  <KeyStat
                    data-testid="total-comp-stat"
                    label="Total Comp"
                    value={formatCurrency(experience.totalCompensationReceived / 100)}
                  />
                ) : null}
              </div>

              {experience.skillsAcquired && experience.skillsAcquired.length > 0 ? (
                <div data-testid="skills-section" className="space-y-2">
                  <span className="block text-xs text-muted-foreground">Skills & Technologies</span>
                  <div className="flex flex-wrap gap-2" data-testid="skills-list">
                    {experience.skillsAcquired.slice(0, 8).map((skill) => (
                      <Badge
                        key={skill}
                        variant="secondary"
                        className="max-w-[140px] truncate"
                        data-testid="skill-tag"
                        title={skill}
                      >
                        {skill}
                      </Badge>
                    ))}
                    {experience.skillsAcquired.length > 8 ? (
                      <Badge variant="outline" data-testid="more-skills-tag">
                        +{experience.skillsAcquired.length - 8} more
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="md:hidden">
        <CardContent className="divide-y divide-border p-0">
          {sortedExperiences.map((experience) => (
            <Link
              key={experience.id}
              to={`/career/experience/${experience.id}`}
              className="block p-4 transition-colors duration-200 hover:bg-muted/40 focus:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-inset"
              data-testid={`mobile-experience-${experience.id}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-sm font-medium text-foreground"
                    data-testid="mobile-job-title"
                  >
                    {experience.role}
                  </div>
                  <div
                    className="truncate text-sm text-muted-foreground"
                    data-testid="mobile-company-name"
                  >
                    {experience.company}
                  </div>
                  {experience.startDate ? (
                    <div
                      className="mt-1 text-xs text-muted-foreground"
                      data-testid="mobile-duration"
                    >
                      {formatDuration(experience.startDate, experience.endDate)}
                    </div>
                  ) : null}
                </div>
                <div className="ml-4 flex items-center space-x-3">
                  {!experience.endDate ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 text-emerald-700"
                      data-testid="mobile-current-badge"
                    >
                      Current
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground" data-testid="mobile-end-date">
                      {experience.endDate
                        ? new Date(experience.endDate).toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric',
                          })
                        : ''}
                    </span>
                  )}
                  <ChevronRightIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

const KeyStat = ({
  label,
  value,
  ...props
}: ComponentProps<'div'> & { label: string; value: string }) => {
  return (
    <div className="min-w-0 rounded-lg bg-muted/50 p-3" {...props}>
      <span className="mb-1 block truncate text-xs text-muted-foreground">{label}</span>
      <span className="block truncate text-sm font-medium text-foreground" title={value}>
        {value}
      </span>
    </div>
  );
};
