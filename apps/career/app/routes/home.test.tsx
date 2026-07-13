import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import type { CareerStoryTimeline } from '~/lib/career/queries/career-timeline';

import type { Route } from './+types/home';
import Home from './home';

const emptyTimeline: CareerStoryTimeline = {
  chapters: [],
  unattributedEntries: [],
};

function renderHome(timeline: CareerStoryTimeline) {
  render(
    <MemoryRouter>
      <Home
        {...({
          params: {},
          matches: [],
        } as unknown as Route.ComponentProps)}
        loaderData={{
          authenticated: true,
          timeline,
        }}
      />
    </MemoryRouter>,
  );
}

describe('Home career story timeline', () => {
  it('renders the story heading', () => {
    renderHome(emptyTimeline);

    expect(screen.getByText('Your career story')).toBeInTheDocument();
  });

  it('shows an empty state with no chapters or entries', () => {
    renderHome(emptyTimeline);

    expect(
      screen.getByText('Your story starts as soon as you add a role, a project, or a skill.'),
    ).toBeInTheDocument();
  });

  it('renders a chapter and its entries', () => {
    renderHome({
      chapters: [
        {
          workExperience: {
            id: 'we-1',
            portfolioId: 'p-1',
            role: 'Senior Product Designer',
            company: 'Vantage Robotics',
            description: '',
            startDate: '2023-03-01T00:00:00.000Z',
            endDate: null,
            action: null,
            tags: [],
            metadata: {},
            sortOrder: 0,
            isVisible: true,
            image: null,
            gradient: null,
            metrics: null,
            baseSalary: null,
            signingBonus: null,
            annualBonus: null,
            currency: 'USD',
            bonusHistory: [],
            salaryAdjustments: [],
            salaryRange: [],
            employmentType: 'full-time',
            workArrangement: 'remote',
            seniorityLevel: 'senior',
            department: null,
            teamSize: null,
            directReports: 0,
            reportsTo: null,
            benefits: [],
            performanceRatings: [],
            reasonForLeaving: null,
            exitNotes: null,
            createdat: '2023-03-01T00:00:00.000Z',
            updatedat: '2023-03-01T00:00:00.000Z',
          },
          entries: [
            {
              id: 'project:1',
              date: '2026-07-13T00:00:00.000Z',
              kind: 'project',
              title: 'Shipped "Onboarding redesign"',
              workExperienceId: 'we-1',
            },
          ],
        },
      ],
      unattributedEntries: [],
    });

    expect(screen.getByText('Senior Product Designer')).toBeInTheDocument();
    expect(screen.getByText(/Vantage Robotics/)).toBeInTheDocument();
    expect(screen.getByText('Shipped "Onboarding redesign"')).toBeInTheDocument();
  });
});
