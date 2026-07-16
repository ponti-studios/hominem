import { EntityListTable, StatusBadge, type EntityListColumn } from '~/components/patterns';
import { RouterListLink } from '~/components/RouterListLink';
import {
  formatApplicationDate,
  formatApplicationSalary,
  formatStatusText,
  getApplicationStatusTone,
  getCompanyName,
} from '~/lib/utils/applicationUtils';
import type { ApplicationWithCompany } from '~/types/applications';

import type { ApplicationsDesktopTableProps } from './types';

const APPLICATIONS_COLUMNS: EntityListColumn<ApplicationWithCompany>[] = [
  {
    key: 'position',
    header: 'Position',
    width: 'minmax(0,1.5fr)',
    render: (application) => (
      <div className="min-w-0">
        <p className="body-2 truncate text-text-primary">{application.position}</p>
        <p className="body-4 truncate text-text-secondary">{getCompanyName(application.company)}</p>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: 'minmax(0,0.9fr)',
    render: (application) => (
      <StatusBadge
        tone={getApplicationStatusTone(application.status)}
        label={formatStatusText(application.status)}
      />
    ),
  },
  {
    key: 'applied',
    header: 'Applied',
    width: 'minmax(0,0.8fr)',
    render: (application) => (
      <p className="body-4 whitespace-nowrap text-text-tertiary">
        {formatApplicationDate(application.applicationDate || application.startDate || null)}
      </p>
    ),
  },
  {
    key: 'response',
    header: 'Response',
    width: 'minmax(0,0.8fr)',
    render: (application) => (
      <p className="body-4 whitespace-nowrap text-text-tertiary">
        {formatApplicationDate(application.responseDate)}
      </p>
    ),
  },
  {
    key: 'salary',
    header: 'Salary',
    width: 'minmax(0,0.9fr)',
    render: (application) => (
      <p className="body-4 whitespace-nowrap text-text-tertiary">
        {formatApplicationSalary(application.salaryOffered || application.salaryQuoted)}
      </p>
    ),
  },
  {
    key: 'source',
    header: 'Source',
    width: 'minmax(0,0.8fr)',
    render: (application) => (
      <p className="body-4 truncate capitalize text-text-tertiary">{application.source || '—'}</p>
    ),
  },
];

export function ApplicationsDesktopTable({ applications }: ApplicationsDesktopTableProps) {
  return (
    <EntityListTable
      items={applications}
      columns={APPLICATIONS_COLUMNS}
      keyFor={(application) => application.id}
      hrefFor={(application) => `/applications/${application.id}`}
      linkComponent={RouterListLink}
    />
  );
}
