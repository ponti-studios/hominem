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
  const owner_userid = overrides.owner_userid ?? 'user-1';
  const company_id = overrides.company_id ?? 'company-1';

  return {
    id,
    owner_userid,
    company_id,
    position: 'Software Engineer',
    status: JobApplicationStatus.APPLIED,
    start_date: new Date('2024-01-15T00:00:00.000Z'),
    end_date: null,
    location: null,
    job_posting: null,
    requirements: [],
    skills: [],
    job_posting_url: null,
    job_posting_word_count: null,
    salary_quoted: null,
    salary_accepted: null,
    salary_expected: null,
    salary_requested: null,
    salary_offered: null,
    salary_negotiated: null,
    salary_final: null,
    total_comp_offered: null,
    total_comp_final: null,
    equity_offered: null,
    equity_final: null,
    bonus_offered: null,
    bonus_final: null,
    source: null,
    application_date: null,
    response_date: null,
    first_interview_date: null,
    offer_date: null,
    decision_date: null,
    rejection_reason: null,
    withdrawal_reason: null,
    time_to_response: null,
    time_to_first_interview: null,
    time_to_offer: null,
    time_to_decision: null,
    cover_letter: null,
    resume: null,
    job_id: null,
    link: null,
    phone_screen: null,
    reference: false,
    interview_dates: [],
    company_notes: null,
    negotiation_notes: null,
    recruiter_name: null,
    recruiter_email: null,
    recruiter_linkedin: null,
    stages: [],
    createdat: new Date(defaultDate),
    updatedat: new Date(defaultDate),
    company: {
      id: company_id,
      owner_userid: owner_userid,
      name: 'Tech Corp',
      website: null,
      industry: null,
      size: null,
      location: null,
      description: null,
      createdat: new Date(defaultDate),
      updatedat: new Date(defaultDate),
      ...company,
    },
    ...applicationOverrides,
  };
}
