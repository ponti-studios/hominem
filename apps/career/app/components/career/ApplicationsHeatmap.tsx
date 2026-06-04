import { Badge } from '@hominem/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@hominem/ui/card';
import { useMemo, useState } from 'react';

import { useContainerWidth } from '~/hooks/useContainerWidth';
import { cn } from '~/lib/utils';
import type { ApplicationWithCompany } from '~/types/applications';
interface ApplicationsHeatmapProps {
  applications: ApplicationWithCompany[];
}

interface DayData {
  date: string;
  count: number;
  applications: ApplicationWithCompany[];
}

interface EmptyDay {
  date: string;
  count: 0;
  isEmpty: true;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ApplicationsHeatmap({ applications }: ApplicationsHeatmapProps) {
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [containerRef, containerWidth] = useContainerWidth<HTMLDivElement>();

  const containerPadding = 48;
  const weekdayLabelsWidth = 40;
  const gridGap = 8;
  const weekColWidth = 16;

  const availableWidth = Math.max(
    0,
    (containerWidth || 320) - containerPadding - weekdayLabelsWidth - gridGap,
  );
  const maxWeeks = Math.floor(availableWidth / weekColWidth);
  const weeksToShow = Math.max(1, Math.min(52, maxWeeks));

  const days = useMemo(() => {
    const generatedDays: DayData[] = [];
    const today = new Date();

    for (let i = 364; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      const dayApplications = applications.filter((app) => {
        const appDate = app.application_date || app.start_date;
        if (!appDate) return false;

        const appDateString = new Date(appDate).toISOString().split('T')[0];
        return appDateString === dateString;
      });

      generatedDays.push({
        date: dateString,
        count: dayApplications.length,
        applications: dayApplications,
      });
    }

    return generatedDays;
  }, [applications]);

  const allWeeks = useMemo(() => {
    const computedWeeks: (DayData | EmptyDay)[][] = [];

    if (days.length === 0) {
      return computedWeeks;
    }

    const firstDate = new Date(`${days[0].date}T00:00:00`);
    const firstDayOfWeek = firstDate.getUTCDay();

    const paddedDays: (DayData | EmptyDay)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      const emptyDate = new Date(firstDate);
      emptyDate.setDate(emptyDate.getDate() - (firstDayOfWeek - i));
      paddedDays.push({
        date: `empty-${emptyDate.toISOString().split('T')[0]}`,
        count: 0,
        isEmpty: true,
      });
    }

    paddedDays.push(...days);

    for (let i = 0; i < paddedDays.length; i += 7) {
      computedWeeks.push(paddedDays.slice(i, i + 7));
    }

    return computedWeeks;
  }, [days]);

  const weeks = allWeeks.slice(-weeksToShow);
  const maxCount = Math.max(0, ...days.map((day) => day.count));
  const activeDays = days.filter((day) => day.count > 0).length;

  const getColorClass = (count: number): string => {
    if (count === 0) return 'bg-muted';
    if (count === 1) return 'bg-emerald-500/20';
    if (count === 2) return 'bg-emerald-500/35';
    if (count === 3) return 'bg-emerald-500/55';
    return 'bg-emerald-500/75';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getCompanyName = (company: ApplicationWithCompany['company']): string => {
    if (typeof company === 'string') return company;
    if (company && typeof company === 'object' && company !== null && 'name' in company) {
      return (company as { name: string }).name;
    }
    return 'Unknown';
  };

  return (
    <div ref={containerRef} className="mx-auto max-w-4xl">
      <Card className="relative overflow-hidden border-border bg-card ">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg text-foreground">Application Activity</CardTitle>
              <p className="text-sm text-muted-foreground">
                Your job application activity over the past year
              </p>
            </div>
            <Badge variant="outline">Last 12 months</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex items-start gap-2 overflow-x-auto">
            <div className="flex shrink-0 flex-col space-y-1">
              {WEEKDAYS.map((weekday) => (
                <div key={weekday} className="h-3 text-xs text-muted-foreground">
                  {weekday}
                </div>
              ))}
            </div>

            <div className="flex max-w-full space-x-1">
              {weeks.map((week, weekIndex) => (
                <div key={week[0]?.date || weekIndex} className="flex shrink-0 flex-col space-y-1">
                  {week.map((day) =>
                    'isEmpty' in day && day.isEmpty ? (
                      <div key={day.date} className="h-3 w-3" />
                    ) : (
                      <button
                        key={day.date}
                        type="button"
                        className={cn(
                          'h-3 w-3 rounded-sm transition-all hover:ring-2 hover:ring-ring/40 focus:outline-none focus:ring-2 focus:ring-ring/40',
                          getColorClass(day.count),
                        )}
                        onMouseEnter={() => setSelectedDay(day as DayData)}
                        onMouseLeave={() => setSelectedDay(null)}
                        onFocus={() => setSelectedDay(day as DayData)}
                        onBlur={() => setSelectedDay(null)}
                        title={`${formatDate(day.date)}: ${day.count} application${day.count !== 1 ? 's' : ''}`}
                        aria-label={`${formatDate(day.date)}: ${day.count} application${day.count !== 1 ? 's' : ''}`}
                      />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground">Less</span>
            <div className="flex gap-1">
              <div className="h-3 w-3 rounded-sm bg-muted" />
              <div className="h-3 w-3 rounded-sm bg-emerald-500/20" />
              <div className="h-3 w-3 rounded-sm bg-emerald-500/35" />
              <div className="h-3 w-3 rounded-sm bg-emerald-500/55" />
              <div className="h-3 w-3 rounded-sm bg-emerald-500/75" />
            </div>
            <span className="text-xs text-muted-foreground">More</span>
          </div>

          {selectedDay && selectedDay.count > 0 ? (
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
              <div className="font-medium text-foreground">{formatDate(selectedDay.date)}</div>
              <div className="text-muted-foreground">
                {selectedDay.count} application{selectedDay.count !== 1 ? 's' : ''}
              </div>
              {selectedDay.applications.length > 0 ? (
                <div className="mt-2 space-y-1 border-t border-border pt-2 text-muted-foreground">
                  {selectedDay.applications.slice(0, 3).map((app) => (
                    <div key={app.id} className="truncate">
                      <span className="text-foreground">{app.position}</span> at{' '}
                      {getCompanyName(app.company)}
                    </div>
                  ))}
                  {selectedDay.applications.length > 3 ? (
                    <div className="text-xs">+{selectedDay.applications.length - 3} more</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-4 border-t border-border pt-4 text-center">
            <div className="rounded-lg bg-muted/40 px-3 py-4">
              <div className="text-base font-bold text-foreground md:text-lg">
                {applications.length}
              </div>
              <div className="text-sm text-muted-foreground md:text-base">Total</div>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-4">
              <div className="text-base font-bold text-foreground md:text-lg">{activeDays}</div>
              <div className="text-sm text-muted-foreground md:text-base">Active</div>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-4">
              <div className="text-base font-bold text-foreground md:text-lg">{maxCount}</div>
              <div className="text-sm text-muted-foreground md:text-base">Most</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
