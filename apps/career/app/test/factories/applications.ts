import type { ApplicationWithCompany } from '~/types/applications';
import { JobApplicationStatus } from '~/types/career';

type ApplicationOverrides = Partial<Omit<ApplicationWithCompany, 'company'>> & {
  company?: Partial<NonNullable<ApplicationWithCompany['company']>>;
};

const defaultDate = new Date('2024-01-01T00:00:00.000Z');

export function makeApplicationWithCompany(
  overrides: ApplicationOverrides = {},
): ApplicationWithCompany {
  const { company, ...applicationOverrides } = overrides;
  const id = overrides.id ?? 'application-1';
  const userId = overrides.userId ?? 'user-1';
  const companyId = overrides.companyId ?? 'company-1';

  return {
    id,
    userId,
    companyId,
    position: 'Software Engineer',
    status: JobApplicationStatus.APPLIED,
    startDate: new Date('2024-01-15T00:00:00.000Z'),
    endDate: null,
    location: null,
    jobPosting: null,
    requirements: [],
    skills: [],
    jobPostingUrl: null,
    jobPostingWordCount: null,
    salaryQuoted: null,
    salaryAccepted: null,
    salaryExpected: null,
    salaryRequested: null,
    salaryOffered: null,
    salaryNegotiated: null,
    salaryFinal: null,
    totalCompOffered: null,
    totalCompFinal: null,
    equityOffered: null,
    equityFinal: null,
    bonusOffered: null,
    bonusFinal: null,
    source: null,
    applicationDate: null,
    responseDate: null,
    firstInterviewDate: null,
    offerDate: null,
    decisionDate: null,
    rejectionReason: null,
    withdrawalReason: null,
    timeToResponse: null,
    timeToFirstInterview: null,
    timeToOffer: null,
    timeToDecision: null,
    coverLetter: null,
    resume: null,
    jobId: null,
    link: null,
    phoneScreen: null,
    reference: false,
    interviewDates: [],
    companyNotes: null,
    negotiationNotes: null,
    recruiterName: null,
    recruiterEmail: null,
    recruiterLinkedin: null,
    stages: [],
    createdAt: new Date(defaultDate),
    updatedAt: new Date(defaultDate),
    company: {
      id: companyId,
      ownerUserId: userId,
      name: 'Tech Corp',
      website: null,
      industry: null,
      size: null,
      location: null,
      description: null,
      createdAt: new Date(defaultDate),
      updatedAt: new Date(defaultDate),
      ...company,
    },
    ...applicationOverrides,
  };
}
