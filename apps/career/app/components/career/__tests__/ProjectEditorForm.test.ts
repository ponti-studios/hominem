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
        shortDescription: '  One line  ',
        liveUrl: ' https://example.com ',
        githubUrl: '',
        imageUrl: '   ',
        videoUrl: undefined,
        technologies: [' React ', 'TypeScript', ''],
        portfolioId: 'portfolio-1',
        workExperienceId: '',
      }),
    ).toEqual({
      title: 'Launch Platform',
      description: 'Shipped a new experience',
      shortDescription: 'One line',
      liveUrl: 'https://example.com',
      githubUrl: null,
      imageUrl: null,
      videoUrl: null,
      technologies: ['React', 'TypeScript'],
      portfolioId: 'portfolio-1',
      workExperienceId: null,
    });
  });
});
