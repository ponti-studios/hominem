import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CareerRecordIndexShell } from '../CareerRecordIndexShell';

describe('CareerRecordIndexShell', () => {
  it('renders the shared header, metrics slot, and section content', () => {
    render(
      <CareerRecordIndexShell
        title="Projects"
        subtitle="Manage your work"
        primaryAction={<button type="button">Add</button>}
        metrics={<div>Metrics Slot</div>}
        sectionTitle="Your Projects"
      >
        <div>Project rows</div>
      </CareerRecordIndexShell>,
    );

    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Manage your work')).toBeInTheDocument();
    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.getByText('Metrics Slot')).toBeInTheDocument();
    expect(screen.getByText('Your Projects')).toBeInTheDocument();
    expect(screen.getByText('Project rows')).toBeInTheDocument();
  });

  it('renders the empty state in place of content when provided', () => {
    render(
      <CareerRecordIndexShell
        title="Certifications"
        subtitle="Track progress"
        sectionTitle="Your Certifications"
        emptyState={<div>No certifications yet</div>}
      />,
    );

    expect(screen.getByText('No certifications yet')).toBeInTheDocument();
    expect(screen.queryByText('Project rows')).not.toBeInTheDocument();
  });
});
