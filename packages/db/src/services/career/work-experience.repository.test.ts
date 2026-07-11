import { describe, expect, it } from 'vitest';

import {
  redactWorkExperienceForPublic,
  type WorkExperienceRecord,
} from './work-experience.repository';

describe('redactWorkExperienceForPublic', () => {
  it('omits compensation and employment-sensitive fields from public output', () => {
    const record: WorkExperienceRecord = {
      id: 'work-1', portfolioId: 'portfolio-1', role: 'Engineer', company: 'Hominem', description: 'Builds products',
      startDate: null, endDate: null, action: null, tags: [], metadata: {}, sortOrder: 0, isVisible: true,
      image: null, gradient: null, metrics: null, baseSalary: 150000, signingBonus: 10000, annualBonus: 20000,
      currency: 'USD', bonusHistory: [], salaryAdjustments: [], salaryRange: {}, employmentType: 'full-time',
      workArrangement: 'remote', seniorityLevel: 'senior', department: null, teamSize: 8, directReports: 2,
      reportsTo: 'Manager', benefits: {}, performanceRatings: [], reasonForLeaving: null, exitNotes: null,
      createdat: '2026-01-01T00:00:00Z', updatedat: '2026-01-01T00:00:00Z',
    };

    const result = redactWorkExperienceForPublic(record);

    expect(result).toMatchObject({ id: 'work-1', role: 'Engineer', company: 'Hominem' });
    for (const field of ['baseSalary', 'signingBonus', 'annualBonus', 'salaryRange', 'reportsTo', 'exitNotes']) {
      expect(result).not.toHaveProperty(field);
    }
  });
});
