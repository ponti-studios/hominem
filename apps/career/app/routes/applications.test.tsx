import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { NO_STATUS_FILTER } from '~/lib/career/queries/job-applications';
import { makeApplication } from '~/test/factories/applications';
import { JobApplicationStatus } from '~/types/career';

import type { Route } from './+types/applications';
import Applications from './applications';

function loaderData(overrides: Partial<Route.ComponentProps['loaderData']> = {}) {
  return {
    applications: [],
    total: 0,
    hasApplications: false,
    statusOptions: [],
    ...overrides,
  };
}

describe('Applications route', () => {
  it('renders the applications table with records', () => {
    render(
      <MemoryRouter initialEntries={['/applications']}>
        <Applications
          loaderData={loaderData({
            applications: [
              makeApplication({
                id: 'application-1',
                title: 'Staff Engineer',
                status: JobApplicationStatus.SCREENING,
                source: 'linkedin',
                company: 'Example Co',
                stageCount: 0,
                hasOffer: false,
              }),
            ],
            total: 1,
            hasApplications: true,
            statusOptions: [{ value: JobApplicationStatus.SCREENING, label: 'SCREENING (1)' }],
          })}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('Staff Engineer').length).toBeGreaterThan(0);
    expect(screen.getByText('Applications')).toBeInTheDocument();
  });

  it('shows the "No applications yet" state when there are no applications', () => {
    render(
      <MemoryRouter initialEntries={['/applications']}>
        <Applications loaderData={loaderData()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('No applications yet')).toBeInTheDocument();
  });

  it('shows the "No matching applications" state when filters match nothing', () => {
    render(
      <MemoryRouter initialEntries={['/applications?status=OFFER']}>
        <Applications
          loaderData={loaderData({
            hasApplications: true,
            statusOptions: [
              { value: NO_STATUS_FILTER, label: 'No status (1)' },
              { value: 'OFFER', label: 'OFFER (0)' },
            ],
          })}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('No matching applications')).toBeInTheDocument();
  });
});
