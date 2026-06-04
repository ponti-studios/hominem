import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeApplicationWithCompany } from '~/test/factories/applications';
import { JobApplicationStatus } from '~/types/career';

import { ApplicationsHeatmap } from '../ApplicationsHeatmap';

const mockApplications = [
  makeApplicationWithCompany({
    id: '1',
    owner_userid: 'user1',
    position: 'Software Engineer',
    company_id: 'company1',
    company: {
      id: 'company1',
      owner_userid: 'user1',
      name: 'Tech Corp',
    },
    status: JobApplicationStatus.APPLIED,
    start_date: new Date('2024-01-15T00:00:00.000Z'),
  }),
  makeApplicationWithCompany({
    id: '2',
    owner_userid: 'user1',
    position: 'Frontend Developer',
    company_id: 'company2',
    company: {
      id: 'company2',
      owner_userid: 'user1',
      name: 'Startup Inc',
    },
    status: JobApplicationStatus.APPLIED,
    start_date: new Date('2024-01-15T00:00:00.000Z'),
  }),
  makeApplicationWithCompany({
    id: '3',
    owner_userid: 'user1',
    position: 'Full Stack Developer',
    company_id: 'company3',
    company: {
      id: 'company3',
      owner_userid: 'user1',
      name: 'Big Tech',
    },
    status: JobApplicationStatus.APPLIED,
    start_date: new Date('2024-01-20T00:00:00.000Z'),
  }),
];

describe('ApplicationsHeatmap', () => {
  it('renders the heatmap with title and description', () => {
    render(<ApplicationsHeatmap applications={mockApplications} />);

    expect(screen.getByText('Application Activity')).toBeInTheDocument();
    expect(
      screen.getByText('Your job application activity over the past year'),
    ).toBeInTheDocument();
  });

  it('shows summary statistics', () => {
    render(<ApplicationsHeatmap applications={mockApplications} />);

    expect(screen.getByText('3')).toBeInTheDocument(); // Total applications
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Most')).toBeInTheDocument();
  });

  it('renders weekday labels', () => {
    render(<ApplicationsHeatmap applications={mockApplications} />);

    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
  });

  it('shows legend with color indicators', () => {
    render(<ApplicationsHeatmap applications={mockApplications} />);

    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('handles empty applications array', () => {
    render(<ApplicationsHeatmap applications={[]} />);

    expect(screen.getByText('Application Activity')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Most')).toBeInTheDocument();

    // Check that all summary stats show 0
    const zeroElements = screen.getAllByText('0');
    expect(zeroElements).toHaveLength(3); // Total, Active, Most
  });
});
