import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeApplicationWithCompany } from '~/test/factories/applications';
import { JobApplicationStatus } from '~/types/career';

import { ActivityHeatmapCard } from '../ActivityHeatmapCard';
import { ApplicationMetricsCard } from '../ApplicationMetricsCard';

const mockApplications = [
  makeApplicationWithCompany({
    id: '1',
    ownerUserid: 'user1',
    position: 'Software Engineer',
    companyId: 'company1',
    company: {
      id: 'company1',
      ownerUserid: 'user1',
      name: 'Tech Corp',
    },
    status: JobApplicationStatus.APPLIED,
    startDate: new Date('2024-01-15T00:00:00.000Z'),
  }),
  makeApplicationWithCompany({
    id: '2',
    ownerUserid: 'user1',
    position: 'Frontend Developer',
    companyId: 'company2',
    company: {
      id: 'company2',
      ownerUserid: 'user1',
      name: 'Startup Inc',
    },
    status: JobApplicationStatus.APPLIED,
    startDate: new Date('2024-01-15T00:00:00.000Z'),
  }),
  makeApplicationWithCompany({
    id: '3',
    ownerUserid: 'user1',
    position: 'Full Stack Developer',
    companyId: 'company3',
    company: {
      id: 'company3',
      ownerUserid: 'user1',
      name: 'Big Tech',
    },
    status: JobApplicationStatus.APPLIED,
    startDate: new Date('2024-01-20T00:00:00.000Z'),
  }),
];

const mockMetrics = {
  totalApplications: 3,
  responseRate: 67,
  interviewRate: 33,
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
  sourceMetrics: [],
  statusBreakdown: [],
};

describe('ActivityHeatmapCard', () => {
  it('renders the heatmap with title', () => {
    render(<ActivityHeatmapCard applications={mockApplications} />);
    expect(screen.getByText('Application Activity')).toBeInTheDocument();
    expect(screen.getByText('Last 12 months')).toBeInTheDocument();
  });

  it('renders weekday labels', () => {
    render(<ActivityHeatmapCard applications={mockApplications} />);
    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
  });

  it('shows legend with color indicators', () => {
    render(<ActivityHeatmapCard applications={mockApplications} />);
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('handles empty applications array', () => {
    render(<ActivityHeatmapCard applications={[]} />);
    expect(screen.getByText('Application Activity')).toBeInTheDocument();
  });
});

describe('ApplicationMetricsCard', () => {
  it('renders summary statistics', () => {
    render(<ApplicationMetricsCard applications={mockApplications} metrics={mockMetrics} />);
    expect(screen.getByText('Application Metrics')).toBeInTheDocument();
    expect(screen.getByText('Applications')).toBeInTheDocument();
    expect(screen.getByText('Active Days')).toBeInTheDocument();
    expect(screen.getByText('Response Rate')).toBeInTheDocument();
    expect(screen.getByText('Interview Rate')).toBeInTheDocument();
    expect(screen.getByText('Offer Rate')).toBeInTheDocument();
    expect(screen.getByText('Avg. Response Time')).toBeInTheDocument();
  });

  it('renders timing analysis', () => {
    render(<ApplicationMetricsCard applications={mockApplications} metrics={mockMetrics} />);
    expect(screen.getByText('Timing Analysis')).toBeInTheDocument();
    expect(screen.getByText('Avg. Offer Time')).toBeInTheDocument();
    expect(screen.getByText('Avg. Decision Time')).toBeInTheDocument();
    expect(screen.getByText('Acceptance Rate')).toBeInTheDocument();
  });

  it('renders salary insights', () => {
    render(<ApplicationMetricsCard applications={mockApplications} metrics={mockMetrics} />);
    expect(screen.getByText('Salary Insights')).toBeInTheDocument();
    expect(screen.getByText('Average Offered')).toBeInTheDocument();
    expect(screen.getByText('Average Accepted')).toBeInTheDocument();
    expect(screen.getByText('Negotiation Success')).toBeInTheDocument();
  });

  it('handles empty applications array', () => {
    render(
      <ApplicationMetricsCard
        applications={[]}
        metrics={{ ...mockMetrics, totalApplications: 0 }}
      />,
    );
    expect(screen.getByText('Application Metrics')).toBeInTheDocument();
    expect(screen.getByText('Active Days')).toBeInTheDocument();
  });
});
