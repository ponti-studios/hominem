import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { makeApplicationWithCompany } from '~/test/factories/applications';
import { JobApplicationStatus } from '~/types/career';

import { ApplicationOverviewTab } from '../ApplicationOverviewTab';

function renderOverview(overrides: Parameters<typeof makeApplicationWithCompany>[0] = {}) {
  const application = makeApplicationWithCompany({
    position: 'Staff Engineer',
    status: JobApplicationStatus.INTERVIEW,
    location: 'Remote',
    source: 'LinkedIn',
    company: { name: 'Example Co', website: 'https://example.com' },
    ...overrides,
  });

  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <ApplicationOverviewTab application={application} company={application.company} />,
      },
    ],
    { initialEntries: ['/'] },
  );

  return render(<RouterProvider router={router} />);
}

describe('ApplicationOverviewTab', () => {
  it('renders application details in view mode', () => {
    renderOverview();

    expect(screen.getByText('Staff Engineer')).toBeInTheDocument();
    expect(screen.getByText('Example Co')).toBeInTheDocument();
    expect(screen.getByText('Remote')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
  });

  it('opens details edit form with current values', async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(screen.getByTestId('application-details-edit'));

    expect(screen.getByLabelText(/job title/i)).toHaveValue('Staff Engineer');
    expect(screen.getByTestId('application-details-save')).toBeInTheDocument();
  });

  it('cancels details edit and returns to view mode', async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(screen.getByTestId('application-details-edit'));
    expect(screen.getByTestId('application-details-save')).toBeInTheDocument();

    await user.click(screen.getByTestId('application-details-edit'));
    expect(screen.queryByTestId('application-details-save')).not.toBeInTheDocument();
    expect(screen.getByText('Staff Engineer')).toBeInTheDocument();
  });
});
