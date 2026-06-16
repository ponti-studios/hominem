import { Badge } from '@hominem/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@hominem/ui/card';
import { useMemo } from 'react';

import { useContainerWidth } from '~/hooks/useContainerWidth';
import { cn } from '~/lib/utils';
import type { ApplicationWithCompany } from '~/types/applications';

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

interface ActivityHeatmapCardProps {
  applications: ApplicationWithCompany[];
}

export function ActivityHeatmapCard({ applications }: ActivityHeatmapCardProps) {
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
        return new Date(appDate).toISOString().split('T')[0] === dateString;
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

    if (days.length === 0) return computedWeeks;

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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div ref={containerRef}>
      <Card className="relative overflow-hidden border-border bg-card">
        <CardHeader className="space-y-2 flex items-center">
          <CardTitle className="heading-3 text-foreground">Application Activity</CardTitle>
          <Badge variant="outline">Last 12 months</Badge>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-2 h-fit" data-testid="heatmap">
            <div className="flex items-center gap-1">
              <div className="flex shrink-0 flex-col space-y-1">
                {WEEKDAYS.map((weekday) => (
                  <div key={weekday} className="h-3 body-4 text-muted-foreground">
                    {weekday}
                  </div>
                ))}
              </div>

              <div className="flex max-w-full space-x-1">
                {weeks.map((week, weekIndex) => (
                  <div
                    key={week[0]?.date || weekIndex}
                    className="flex shrink-0 flex-col space-y-1"
                  >
                    {week.map((day) => (
                      <div
                        key={day.date}
                        title={`${formatDate(day.date)}: ${day.count} application${day.count !== 1 ? 's' : ''}`}
                        aria-label={`${formatDate(day.date)}: ${day.count} application${day.count !== 1 ? 's' : ''}`}
                        className={cn('size-3 rounded-sm transition-all', {
                          'bg-muted': day.count === 0,
                          'bg-success/20': day.count === 1,
                          'bg-success/35': day.count === 2,
                          'bg-success/55': day.count === 3,
                          'bg-success/75': day.count >= 4,
                        })}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <span className="body-4 text-muted-foreground">Less</span>
              <div className="flex gap-1">
                <div className="size-3 rounded-sm bg-muted" />
                <div className="size-3 rounded-sm bg-success/20" />
                <div className="size-3 rounded-sm bg-success/35" />
                <div className="size-3 rounded-sm bg-success/55" />
                <div className="size-3 rounded-sm bg-success/75" />
              </div>
              <span className="body-4 text-muted-foreground">More</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
