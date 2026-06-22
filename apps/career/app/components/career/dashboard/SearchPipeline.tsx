import { Card, CardContent } from '@hominem/ui/card';

import type { ApplicationWithCompany } from '~/types/applications';

const DEAD_STATUSES = ['REJECTED', 'WITHDRAWN', 'CLOSED', 'NO_OFFER', 'DECLINED'];

function isLive(app: ApplicationWithCompany) {
  return !DEAD_STATUSES.some((s) => app.status?.toUpperCase().includes(s));
}

function getPipelineCounts(applications: ApplicationWithCompany[]) {
  const live = applications.filter(isLive);

  const offer = live.filter((a) => a.status === 'OFFER' || a.status === 'ACCEPTED').length;

  const interviewing = live.filter(
    (a) => a.first_interview_date && a.status !== 'OFFER' && a.status !== 'ACCEPTED',
  ).length;

  const screening = live.filter(
    (a) =>
      a.response_date && !a.first_interview_date && a.status !== 'OFFER' && a.status !== 'ACCEPTED',
  ).length;

  const waiting = live.filter(
    (a) => !a.response_date && a.status !== 'OFFER' && a.status !== 'ACCEPTED',
  ).length;

  return { waiting, screening, interviewing, offer };
}

interface SearchPipelineProps {
  applications: ApplicationWithCompany[];
}

export function SearchPipeline({ applications }: SearchPipelineProps) {
  const { waiting, screening, interviewing, offer } = getPipelineCounts(applications);

  const stages = [
    { label: 'Waiting', count: waiting },
    { label: 'Screening', count: screening },
    { label: 'Interviewing', count: interviewing },
    { label: 'Offer', count: offer },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stages.map(({ label, count }) => (
        <Card key={label}>
          <CardContent className="pt-4">
            <div className="flex items-baseline gap-2">
              <span className={`ui-data-value ${count === 0 ? 'text-muted-foreground' : ''}`}>
                {count}
              </span>
              <span className="ui-data-label">{label}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
