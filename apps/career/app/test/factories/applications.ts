import type { CareerApplicationRecord } from '@hominem/db/career';

type MadeApplication = CareerApplicationRecord & {
  currentStage: string | null;
  stageCount: number;
  hasOffer: boolean;
};

export function makeApplication(overrides: Partial<MadeApplication> = {}): MadeApplication {
  return {
    id: 'app-1',
    ownerUserid: 'user-1',
    company: 'Acme Corp',
    title: 'Software Engineer',
    location: 'San Francisco, CA',
    source: 'LinkedIn',
    referredBy: null,
    appliedAt: '2024-01-01',
    currentStage: 'interview',
    currentStageId: null,
    status: 'APPLIED',
    resumeUrl: null,
    coverLetterUrl: null,
    jobPostingUrl: 'https://example.com/job',
    salaryExpectation: null,
    notes: null,
    stageCount: 0,
    hasOffer: false,
    legacyId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}
