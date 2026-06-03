import { describe, expect, it } from 'vitest';

import { makeConvertedResumeData } from '~/test/factories/resume';

import { normalizePortfolioSlug, resumeSchema } from './resume';

describe('resume schema', () => {
  it('normalizes portfolio slugs', () => {
    expect(normalizePortfolioSlug('  Charles Ponti!! Senior Engineer  ')).toBe(
      'charles-ponti-senior-engineer',
    );
  });

  it('rejects blank required strings', () => {
    const resume = makeConvertedResumeData({ portfolio: { bio: '   ' } });
    const result = resumeSchema.safeParse(resume);

    expect(result.success).toBe(false);
  });

  it('defaults omitted repeatable sections to empty arrays', () => {
    const withoutArrays: Record<string, unknown> = { ...makeConvertedResumeData() };
    delete withoutArrays.workExperience;
    delete withoutArrays.skills;
    delete withoutArrays.projects;
    delete withoutArrays.stats;

    const result = resumeSchema.safeParse(withoutArrays);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.workExperience).toEqual([]);
      expect(result.data.skills).toEqual([]);
      expect(result.data.projects).toEqual([]);
      expect(result.data.stats).toEqual([]);
    }
  });

  it('normalizes month dates and current end dates', () => {
    const result = resumeSchema.safeParse({
      ...makeConvertedResumeData(),
      workExperience: [
        {
          company: 'Company',
          role: 'Engineer',
          description: 'Built products',
          startDate: '2020-01',
          endDate: 'Current',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.workExperience[0]).toMatchObject({
        startDate: '2020-01-01',
        endDate: null,
      });
    }
  });

  it('rejects invalid dates before database save', () => {
    const result = resumeSchema.safeParse({
      ...makeConvertedResumeData(),
      workExperience: [
        {
          company: 'Company',
          role: 'Engineer',
          description: 'Built products',
          startDate: '2020-99-99',
          endDate: null,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
