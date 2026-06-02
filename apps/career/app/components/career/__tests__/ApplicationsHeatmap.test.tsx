import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ApplicationWithCompany } from '~/types/applications'
import { JobApplicationStatus } from '~/types/career'
import { ApplicationsHeatmap } from '../ApplicationsHeatmap'

// Mock data for testing
const mockApplications: ApplicationWithCompany[] = [
  {
    id: '1',
    userId: 'user1',
    position: 'Software Engineer',
    companyId: 'company1',
    company: 'Tech Corp',
    status: JobApplicationStatus.APPLIED,
    startDate: new Date('2024-01-15'),
    reference: false,
    stages: [],
  },
  {
    id: '2',
    userId: 'user1',
    position: 'Frontend Developer',
    companyId: 'company2',
    company: 'Startup Inc',
    status: JobApplicationStatus.APPLIED,
    startDate: new Date('2024-01-15'), // Same date as first application
    reference: false,
    stages: [],
  },
  {
    id: '3',
    userId: 'user1',
    position: 'Full Stack Developer',
    companyId: 'company3',
    company: 'Big Tech',
    status: JobApplicationStatus.APPLIED,
    startDate: new Date('2024-01-20'),
    reference: false,
    stages: [],
  },
]

describe('ApplicationsHeatmap', () => {
  it('renders the heatmap with title and description', () => {
    render(<ApplicationsHeatmap applications={mockApplications} />)

    expect(screen.getByText('Application Activity')).toBeInTheDocument()
    expect(screen.getByText('Your job application activity over the past year')).toBeInTheDocument()
  })

  it('shows summary statistics', () => {
    render(<ApplicationsHeatmap applications={mockApplications} />)

    expect(screen.getByText('3')).toBeInTheDocument() // Total applications
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Most')).toBeInTheDocument()
  })

  it('renders weekday labels', () => {
    render(<ApplicationsHeatmap applications={mockApplications} />)

    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Tue')).toBeInTheDocument()
    expect(screen.getByText('Wed')).toBeInTheDocument()
    expect(screen.getByText('Thu')).toBeInTheDocument()
    expect(screen.getByText('Fri')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
  })

  it('shows legend with color indicators', () => {
    render(<ApplicationsHeatmap applications={mockApplications} />)

    expect(screen.getByText('Less')).toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()
  })

  it('handles empty applications array', () => {
    render(<ApplicationsHeatmap applications={[]} />)

    expect(screen.getByText('Application Activity')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Most')).toBeInTheDocument()

    // Check that all summary stats show 0
    const zeroElements = screen.getAllByText('0')
    expect(zeroElements).toHaveLength(3) // Total, Active, Most
  })
})
