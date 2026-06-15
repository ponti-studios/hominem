import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import type { Route } from './+types/home';
import Home from './home';

describe('Home dashboard', () => {
  it('renders level progression alongside the existing career charts', () => {
    render(
      <MemoryRouter>
        <Home
          {...({
            params: {},
            matches: [],
          } as unknown as Route.ComponentProps)}
          loaderData={{
            authenticated: true,
            careerSummary: {
              totalExperience: 8.5,
              currentSalary: 25000000,
              firstSalary: 12000000,
              totalSalaryGrowth: 13000000,
              salaryGrowthPercentage: 108.3,
              averageAnnualGrowth: 12.7,
              promotionCount: 3,
              jobChangeCount: 2,
              averageTenurePerJob: 2.8,
              highestSalaryIncrease: {
                amount: 5000000,
                percentage: 20,
                reason: 'promotion',
                date: '2024-01-01T00:00:00.000Z',
              },
              salaryByYear: [
                {
                  year: 2022,
                  salary: 18000000,
                  totalComp: 18000000,
                  company: 'Example Co',
                  title: 'Senior Engineer',
                },
                {
                  year: 2024,
                  salary: 25000000,
                  totalComp: 25000000,
                  company: 'Example Co',
                  title: 'Staff Engineer',
                },
              ],
              currentLevel: 'staff',
              levelProgression: [
                {
                  level: 'senior',
                  duration: 24,
                  start_date: '2022-01-01T00:00:00.000Z',
                  end_date: '2023-12-31T00:00:00.000Z',
                },
                {
                  level: 'staff',
                  duration: 12,
                  start_date: '2024-01-01T00:00:00.000Z',
                },
              ],
            },
            work_experiences: [],
            allApplications: [],
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
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Salary Progression')).toBeInTheDocument();
    expect(screen.getByText('Level Progression')).toBeInTheDocument();
    expect(screen.getByText('senior')).toBeInTheDocument();
    expect(screen.getByText('24 months')).toBeInTheDocument();
  });
});
