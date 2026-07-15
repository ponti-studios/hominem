import { EntityListCards, StatusBadge } from '@hominem/ui';
import { ChevronRightIcon } from 'lucide-react';

import { RouterListLink } from '~/components/RouterListLink';
import {
  formatApplicationDate,
  formatStatusText,
  getApplicationStatusTone,
  getCompanyName,
} from '~/lib/utils/applicationUtils';

import type { ApplicationsMobileListProps } from './types';

export function ApplicationsMobileList({ applications }: ApplicationsMobileListProps) {
  return (
    <EntityListCards
      items={applications}
      keyFor={(application) => application.id}
      hrefFor={(application) => `/applications/${application.id}`}
      linkComponent={RouterListLink}
      renderCard={(application) => (
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
            <StatusBadge
              tone={getApplicationStatusTone(application.status)}
              label={formatStatusText(application.status)}
            />
            <ChevronRightIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
      )}
    />
  );
}
