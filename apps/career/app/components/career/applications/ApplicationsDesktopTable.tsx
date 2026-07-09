import { Badge } from '@hominem/ui';
import { Link } from 'react-router';

import {
  formatApplicationDate,
  formatApplicationSalary,
  formatStatusText,
  getCompanyName,
  getStatusColor,
} from '~/lib/utils/applicationUtils';

import type { ApplicationsDesktopTableProps } from './types';

export function ApplicationsDesktopTable({ applications }: ApplicationsDesktopTableProps) {
  return (
    <div className="hidden md:block">
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.8fr)] gap-3 bg-muted/20 px-4 py-3 ui-data-label">
        <span>Position</span>
        <span>Status</span>
        <span>Applied</span>
        <span>Response</span>
        <span>Salary</span>
        <span>Source</span>
      </div>

      <ul className="divide-y divide-border">
        {applications.map((application) => (
          <li key={application.id} className="transition-colors duration-150">
            <Link
              to={`/applications/${application.id}`}
              className="grid min-h-16 grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.8fr)] items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="body-2 truncate text-text-primary">{application.position}</p>
                <p className="body-4 truncate text-text-secondary">
                  {getCompanyName(application.company)}
                </p>
              </div>

              <div>
                <Badge variant="outline" className={getStatusColor(application.status)}>
                  {formatStatusText(application.status)}
                </Badge>
              </div>

              <p className="body-4 whitespace-nowrap text-text-tertiary">
                {formatApplicationDate(
                  application.applicationDate || application.startDate || null,
                )}
              </p>

              <p className="body-4 whitespace-nowrap text-text-tertiary">
                {formatApplicationDate(application.responseDate)}
              </p>

              <p className="body-4 whitespace-nowrap text-text-tertiary">
                {formatApplicationSalary(application.salaryOffered || application.salaryQuoted)}
              </p>

              <p className="body-4 truncate capitalize text-text-tertiary">
                {application.source || '—'}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
