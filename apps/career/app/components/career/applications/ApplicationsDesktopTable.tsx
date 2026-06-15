import { Badge } from '@hominem/ui/badge';
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
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.8fr)] gap-3 border-b border-border bg-muted/20 px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <span>Position</span>
        <span>Status</span>
        <span>Applied</span>
        <span>Response</span>
        <span>Salary</span>
        <span>Source</span>
      </div>

      <ul className="divide-y divide-border">
        {applications.map((application) => (
          <li key={application.id} className="transition-colors duration-150 hover:bg-muted/30">
            <Link
              to={`/career/applications/${application.id}`}
              className="grid min-h-16 grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.8fr)] items-center gap-3 px-4 py-3 focus:bg-muted/30 focus:outline-none"
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
                {formatApplicationDate(application.application_date || application.start_date || null)}
              </p>

              <p className="body-4 whitespace-nowrap text-text-tertiary">
                {formatApplicationDate(application.response_date)}
              </p>

              <p className="body-4 whitespace-nowrap text-text-tertiary">
                {formatApplicationSalary(application.salary_offered || application.salary_quoted)}
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
