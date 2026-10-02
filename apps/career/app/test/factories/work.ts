import type { CareerEngagementRecord, CareerProjectRecord } from '@hominem/db/career';

export function makeEngagement(
  overrides: Partial<CareerEngagementRecord> = {},
): CareerEngagementRecord {
  return {
    address: null,
    company: 'Acme Corp',
    contactName: null,
    contactPhone: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    currency: 'USD',
    description: null,
    endDate: null,
    id: 'eng-1',
    isCurrent: false,
    kind: 'EMPLOYMENT',
    location: null,
    ownerUserid: 'user-1',
    reasonForLeaving: null,
    salaryHigh: null,
    salaryLow: null,
    source: null,
    startDate: null,
    title: 'Software Engineer',
    updatedAt: '2024-01-01T00:00:00.000Z',
    url: null,
    ...overrides,
  };
}

export function makeProject(overrides: Partial<CareerProjectRecord> = {}): CareerProjectRecord {
  return {
    createdAt: '2024-01-01T00:00:00.000Z',
    description: null,
    endDate: null,
    engagements: [],
    githubUrl: null,
    id: 'proj-1',
    imageUrl: null,
    isFeatured: false,
    isVisible: true,
    liveUrl: null,
    organization: null,
    ownerUserid: 'user-1',
    shortDescription: null,
    sortOrder: 0,
    startDate: null,
    status: null,
    technologies: [],
    title: 'Project',
    updatedAt: '2024-01-01T00:00:00.000Z',
    videoUrl: null,
    ...overrides,
  };
}
