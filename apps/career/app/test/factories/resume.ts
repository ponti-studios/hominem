import type { ConvertedResumeData, UploadResumeResponse } from '~/types/resume';

type ResumeDataOverrides = Partial<Omit<ConvertedResumeData, 'portfolio'>> & {
  portfolio?: Partial<ConvertedResumeData['portfolio']>;
};

type UploadResponseOverrides = Partial<Omit<UploadResumeResponse, 'data'>> & {
  data?: ConvertedResumeData;
};

export function makeConvertedResumeData(
  overrides: ResumeDataOverrides = {},
): ConvertedResumeData {
  const base: ConvertedResumeData = {
    portfolio: {
      slug: 'charles-ponti',
      title: 'Portfolio',
      name: 'Charles Ponti',
      initials: 'CP',
      job_title: 'Engineer',
      bio: 'Bio',
      tagline: 'Tagline',
      current_location: 'Los Angeles',
      location_tagline: null,
      email: 'charles@example.com',
      phone: null,
      availability_status: true,
      availability_message: null,
      is_public: true,
      is_active: true,
    },
    social_links: null,
    workExperience: [],
    skills: [],
    projects: [],
    stats: [],
  };

  return {
    ...base,
    ...overrides,
    portfolio: {
      ...base.portfolio,
      ...overrides.portfolio,
    },
  };
}

export function makeUploadResumeResponse(
  overrides: UploadResponseOverrides = {},
): UploadResumeResponse {
  return {
    message: 'ok',
    data: makeConvertedResumeData(),
    saved: true,
    portfolio_id: 'portfolio-id',
    portfolioSlug: 'charles-ponti',
    portfolioUrl: '/p/charles-ponti',
    fileUrl: 'http://localhost/resume.pdf',
    stage: 'complete',
    retryable: false,
    ...overrides,
  };
}
