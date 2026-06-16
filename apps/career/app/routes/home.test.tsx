import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import type { Route } from './+types/home';
import Home from './home';

const baseMetrics = {
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
};

describe('Home dashboard', () => {
  it('renders the three job search sections', () => {
    render(
      <MemoryRouter>
        <Home
          {...({
            params: {},
            matches: [],
          } as unknown as Route.ComponentProps)}
          loaderData={{
            authenticated: true,
            allApplications: [],
            metrics: baseMetrics,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Is anything moving?')).toBeInTheDocument();
    expect(screen.getByText('Is my approach working?')).toBeInTheDocument();
    expect(screen.getByText('How long will this take?')).toBeInTheDocument();
  });

  it('shows pipeline stage counts', () => {
    render(
      <MemoryRouter>
        <Home
          {...({
            params: {},
            matches: [],
          } as unknown as Route.ComponentProps)}
          loaderData={{
            authenticated: true,
            allApplications: [],
            metrics: baseMetrics,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('Screening')).toBeInTheDocument();
    expect(screen.getByText('Interviewing')).toBeInTheDocument();
    expect(screen.getByText('Offer')).toBeInTheDocument();
  });
});
