import { describe, expect, it } from 'vitest';

import { normalizeProjectMutationValues } from '~/lib/career/project-form';

import { formatWorkExperienceOptionLabel } from '../ProjectEditorForm';

describe('ProjectEditorForm helpers', () => {
  it('formats a work experience label with company and role', () => {
    expect(
      formatWorkExperienceOptionLabel({
        id: 'work-1',
        company: 'Acme',
        role: 'Staff Engineer',
      }),
    ).toBe('Acme · Staff Engineer');
  });

  it('normalizes optional project fields before submit', () => {
    expect(
      normalizeProjectMutationValues({
        title: '  Launch Platform  ',
        description: '  Shipped a new experience  ',
        short_description: '  One line  ',
        live_url: ' https://example.com ',
        github_url: '',
        image_url: '   ',
        video_url: undefined,
        technologies: [' React ', 'TypeScript', ''],
        portfolio_id: 'portfolio-1',
        work_experience_id: '',
      }),
    ).toEqual({
      title: 'Launch Platform',
      description: 'Shipped a new experience',
      short_description: 'One line',
      live_url: 'https://example.com',
      github_url: null,
      image_url: null,
      video_url: null,
      technologies: ['React', 'TypeScript'],
      portfolio_id: 'portfolio-1',
      work_experience_id: null,
    });
  });
});
