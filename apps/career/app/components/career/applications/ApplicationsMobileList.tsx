import { Badge } from '@hominem/ui';
import { ChevronRightIcon } from 'lucide-react';
import { Link } from 'react-router';

import {
  formatApplicationDate,
  formatStatusText,
  getCompanyName,
  getStatusColor,
} from '~/lib/utils/applicationUtils';

import type { ApplicationsMobileListProps } from './types';

export function ApplicationsMobileList({ applications }: ApplicationsMobileListProps) {
  return (
    <div className="md:hidden">
      <ul className="divide-y divide-border">
        {applications.map((application) => (
          <li key={application.id} className="transition-colors duration-150">
            <Link to={`/applications/${application.id}`} className="block p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="body-2 truncate text-text-primary">{application.position}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="body-4 truncate text-text-secondary">
                      {getCompanyName(application.company)}
                    </p>
                    <span className="body-4 text-text-tertiary">·</span>
                    <p className="body-4 text-text-tertiary">
                      {formatApplicationDate(
                        application.applicationDate || application.startDate || null,
                      )}
                    </p>
                  </div>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <Badge variant="outline" className={getStatusColor(application.status)}>
                    {formatStatusText(application.status)}
                  </Badge>
                  <ChevronRightIcon className="size-5 text-muted-foreground" aria-hidden="true" />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
