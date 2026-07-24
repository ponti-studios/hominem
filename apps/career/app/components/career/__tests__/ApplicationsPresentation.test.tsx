import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { makeApplicationWithCompany } from '~/test/factories/applications';
import { JobApplicationStatus } from '~/types/career';

import { ApplicationsEmptyState } from '../applications/ApplicationsEmptyState';
import { ApplicationsList } from '../applications/ApplicationsList';

const applications = [
  makeApplicationWithCompany({
    id: 'application-1',
    position: 'Staff Engineer',
    status: JobApplicationStatus.INTERVIEW,
    company: { name: 'Example Co' },
  }),
];

describe('applications presentation components', () => {
  it('renders application details in the list', () => {
    render(
      <MemoryRouter>
        <ApplicationsList applications={applications} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Staff Engineer')).toBeInTheDocument();
    expect(screen.getByText('Example Co')).toBeInTheDocument();
  });

  it('renders the base empty state copy', () => {
    render(
      <MemoryRouter>
        <ApplicationsEmptyState
          kind="base"
          emptyTitle="No applications found"
          emptyDescription="Start tracking your job applications to see them here"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('No applications found')).toBeInTheDocument();
    expect(
      screen.getByText('Start tracking your job applications to see them here'),
    ).toBeInTheDocument();
  });

  it('renders the filtered empty state copy without the create action', () => {
    render(
      <MemoryRouter>
        <ApplicationsEmptyState
          kind="filtered"
          emptyTitle="No applications match your filters"
          emptyDescription="Try adjusting your search criteria"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('No applications match your filters')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add Application' })).not.toBeInTheDocument();
  });
});
