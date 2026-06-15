import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { makeApplicationWithCompany } from '~/test/factories/applications';
import { JobApplicationStatus } from '~/types/career';

import type { Route } from './+types/applications';
import Applications from './applications';

describe('Applications route', () => {
  it('renders the aggregate visualizations above the records list', () => {
    render(
      <MemoryRouter initialEntries={['/applications']}>
        <Applications
          {...({
            params: {},
            matches: [],
          } as unknown as Route.ComponentProps)}
          loaderData={{
            user: {} as Route.ComponentProps['loaderData']['user'],
            allApplications: [
              makeApplicationWithCompany({
                id: 'application-1',
                position: 'Staff Engineer',
                status: JobApplicationStatus.INTERVIEW,
                source: 'linkedin',
                application_date: new Date('2024-01-15T00:00:00.000Z'),
                response_date: new Date('2024-01-20T00:00:00.000Z'),
                first_interview_date: new Date('2024-01-25T00:00:00.000Z'),
                company: { name: 'Example Co' },
              }),
            ],
            applications: [
              makeApplicationWithCompany({
                id: 'application-1',
                position: 'Staff Engineer',
                status: JobApplicationStatus.INTERVIEW,
                source: 'linkedin',
                company: { name: 'Example Co' },
              }),
            ],
            metrics: {
              totalApplications: 1,
              responseRate: 100,
              interviewRate: 100,
              offerRate: 0,
              acceptanceRate: 0,
              averageTimeToResponse: 5,
              averageTimeToOffer: 0,
              averageTimeToDecision: 0,
              salaryMetrics: {
                averageOffered: 0,
                averageAccepted: 0,
                negotiationSuccessRate: 0,
                averageNegotiationIncrease: 0,
              },
              sourceMetrics: [
                {
                  source: 'linkedin',
                  count: 1,
                  responseRate: 100,
                  offerRate: 0,
                },
              ],
              statusBreakdown: [
                {
                  status: JobApplicationStatus.INTERVIEW,
                  count: 1,
                  percentage: 100,
                },
              ],
            },
            topCompanies: [
              {
                company: 'Example Co',
                count: 1,
                offers: 0,
                interviews: 1,
                offerRate: 0,
                interviewRate: 100,
              },
            ],
            pagination: {
              page: 1,
              limit: 10,
              total: 1,
              totalPages: 1,
            },
            filters: {
              search: undefined,
              statuses: [],
              source: undefined,
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Application Activity')).toBeInTheDocument();
    expect(screen.getByText('Application metrics')).toBeInTheDocument();
    expect(screen.getByText('Performance Guide')).toBeInTheDocument();
    expect(screen.getByText('Company Insights')).toBeInTheDocument();
    expect(screen.getAllByText('Staff Engineer').length).toBeGreaterThan(0);
  });

  it('keeps analytics visible when there are no applications', () => {
    render(
      <MemoryRouter initialEntries={['/applications']}>
        <Applications
          {...({
            params: {},
            matches: [],
          } as unknown as Route.ComponentProps)}
          loaderData={{
            user: {} as Route.ComponentProps['loaderData']['user'],
            allApplications: [],
            applications: [],
            metrics: {
              totalApplications: 0,
              responseRate: 0,
              interviewRate: 0,
              offerRate: 0,
              acceptanceRate: 0,
              averageTimeToResponse: 0,
              averageTimeToOffer: 0,
              averageTimeToDecision: 0,
              salaryMetrics: {
                averageOffered: 0,
                averageAccepted: 0,
                negotiationSuccessRate: 0,
                averageNegotiationIncrease: 0,
              },
              sourceMetrics: [],
              statusBreakdown: [],
            },
            topCompanies: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 0,
              totalPages: 0,
            },
            filters: {
              search: undefined,
              statuses: [],
              source: undefined,
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Application metrics')).toBeInTheDocument();
    expect(screen.getByText('No source performance data available')).toBeInTheDocument();
    expect(screen.getByText('No company data available')).toBeInTheDocument();
    expect(screen.getByText('No applications found')).toBeInTheDocument();
  });
});
