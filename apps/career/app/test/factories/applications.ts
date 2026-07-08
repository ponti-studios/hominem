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
  const ownerUserid = overrides.ownerUserid ?? 'user-1';
  const companyId = overrides.companyId ?? 'company-1';

  return {
    id,
    ownerUserid,
    companyId,
    position: 'Software Engineer',
    status: JobApplicationStatus.APPLIED,
    startDate: new Date('2024-01-15T00:00:00.000Z').toISOString(),
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
    createdat: new Date(defaultDate).toISOString(),
    updatedat: new Date(defaultDate).toISOString(),
    company: {
      id: companyId,
      ownerUserid: ownerUserid,
      name: 'Tech Corp',
      website: null,
      industry: null,
      size: null,
      location: null,
      description: null,
      createdat: new Date(defaultDate).toISOString(),
      updatedat: new Date(defaultDate).toISOString(),
      ...company,
    },
    ...applicationOverrides,
  };
}
