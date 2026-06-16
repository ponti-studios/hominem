import type { CareerJobApplicationRecord as ApplicationWithCompany } from '@hominem/db';

import {
  extractJobApplications,
  getUserJobApplications,
  type JobApplicationWithCompany,
} from './base';
import { calculatePercentageChange } from './utils';

export type JobApplicationFilter = {
  status?: string;
  statuses?: string[];
  company_id?: string;
  source?: string;
  search?: string;
  start_date?: Date;
  end_date?: Date;
  salaryMin?: number;
  salaryMax?: number;
};

export type PaginationOptions = {
  limit?: number;
  offset?: number;
  orderBy?: 'application_date' | 'response_date' | 'offer_date' | 'companyName' | 'position';
  orderDirection?: 'asc' | 'desc';
};

export interface JobApplicationMetrics {
  totalApplications: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  acceptanceRate: number;
  averageTimeToResponse: number;
  averageTimeToOffer: number;
  averageTimeToDecision: number;
  salaryMetrics: {
    averageOffered: number;
    averageAccepted: number;
    negotiationSuccessRate: number;
    averageNegotiationIncrease: number;
  };
  sourceMetrics: Array<{
    source: string;
    count: number;
    responseRate: number;
    offerRate: number;
  }>;
  statusBreakdown: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
}

export async function getJobApplicationMetrics(
  applications: ReturnType<typeof extractJobApplications>,
): Promise<JobApplicationMetrics> {
  if (applications.length === 0) {
    return {
      totalApplications: 0,
      responseRate: 0,
      interviewRate: 0,
      offerRate: 0,
      acceptanceRate: 0,
      averageTimeToResponse: 0,
      averageTimeToOffer: 0,
      averageTimeToDecision: 0,
      salaryMetrics: {
        averageOffered: 0,
        averageAccepted: 0,
        negotiationSuccessRate: 0,
        averageNegotiationIncrease: 0,
      },
      sourceMetrics: [],
      statusBreakdown: [],
    };
  }

  const totalApplications = applications.length;
  const responsesReceived = applications.filter((application) => application.response_date).length;
  const interviewsScheduled = applications.filter(
    (application) => application.first_interview_date,
  ).length;
  const offersReceived = applications.filter(
    (application) => application.status === 'OFFER' || application.status === 'ACCEPTED',
  ).length;
  const offersAccepted = applications.filter(
    (application) => application.status === 'ACCEPTED',
  ).length;

  return {
    totalApplications,
    responseRate: (responsesReceived / totalApplications) * 100,
    interviewRate: (interviewsScheduled / totalApplications) * 100,
    offerRate: (offersReceived / totalApplications) * 100,
    acceptanceRate: offersReceived > 0 ? (offersAccepted / offersReceived) * 100 : 0,
    ...calculateTimeMetrics(applications),
    salaryMetrics: calculateSalaryMetrics(applications, offersReceived),
    sourceMetrics: calculateSourceMetrics(applications),
    statusBreakdown: calculateStatusBreakdown(applications, totalApplications),
  };
}

function calculateTimeMetrics(applications: ReturnType<typeof extractJobApplications>) {
  const timeToResponseApps = applications.filter((application) => application.time_to_response);
  const timeToOfferApps = applications.filter((application) => application.time_to_offer);
  const timeToDecisionApps = applications.filter((application) => application.time_to_decision);

  return {
    averageTimeToResponse:
      timeToResponseApps.length > 0
        ? timeToResponseApps.reduce(
            (sum, application) => sum + (application.time_to_response || 0),
            0,
          ) / timeToResponseApps.length
        : 0,
    averageTimeToOffer:
      timeToOfferApps.length > 0
        ? timeToOfferApps.reduce((sum, application) => sum + (application.time_to_offer || 0), 0) /
          timeToOfferApps.length
        : 0,
    averageTimeToDecision:
      timeToDecisionApps.length > 0
        ? timeToDecisionApps.reduce(
            (sum, application) => sum + (application.time_to_decision || 0),
            0,
          ) / timeToDecisionApps.length
        : 0,
  };
}

function calculateSalaryMetrics(
  applications: ReturnType<typeof extractJobApplications>,
  offersReceived: number,
) {
  const offeredSalaries = applications
    .filter((application): application is typeof application & { salary_offered: number } =>
      Boolean(application.salary_offered),
    )
    .map((application) => application.salary_offered);
  const acceptedSalaries = applications
    .filter((application): application is typeof application & { salary_final: number } =>
      Boolean(application.salary_final),
    )
    .map((application) => application.salary_final);
  const negotiatedApps = applications.filter(
    (application) =>
      application.salary_offered &&
      application.salary_negotiated &&
      application.salary_negotiated > application.salary_offered,
  );

  return {
    averageOffered:
      offeredSalaries.length > 0
        ? offeredSalaries.reduce((sum, salary) => sum + salary, 0) / offeredSalaries.length
        : 0,
    averageAccepted:
      acceptedSalaries.length > 0
        ? acceptedSalaries.reduce((sum, salary) => sum + salary, 0) / acceptedSalaries.length
        : 0,
    negotiationSuccessRate: offersReceived > 0 ? (negotiatedApps.length / offersReceived) * 100 : 0,
    averageNegotiationIncrease:
      negotiatedApps.length > 0
        ? negotiatedApps.reduce((sum, application) => {
            if (!application.salary_offered || !application.salary_negotiated) return sum;
            return (
              sum +
              calculatePercentageChange(application.salary_offered, application.salary_negotiated)
            );
          }, 0) / negotiatedApps.length
        : 0,
  };
}

function calculateSourceMetrics(applications: ReturnType<typeof extractJobApplications>) {
  const sourceMap = new Map<string, { count: number; responses: number; offers: number }>();

  for (const application of applications) {
    const source = application.source || 'unknown';
    const current = sourceMap.get(source) || { count: 0, responses: 0, offers: 0 };

    current.count++;
    if (application.response_date) current.responses++;
    if (application.status === 'OFFER' || application.status === 'ACCEPTED') current.offers++;
    sourceMap.set(source, current);
  }

  return Array.from(sourceMap.entries()).map(([source, data]) => ({
    source,
    count: data.count,
    responseRate: (data.responses / data.count) * 100,
    offerRate: (data.offers / data.count) * 100,
  }));
}

function calculateStatusBreakdown(
  applications: ReturnType<typeof extractJobApplications>,
  totalApplications: number,
) {
  const statusMap = new Map<string, number>();

  for (const application of applications) {
    statusMap.set(application.status, (statusMap.get(application.status) || 0) + 1);
  }

  return Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
    percentage: (count / totalApplications) * 100,
  }));
}

export type JobApplicationFunnel = {
  stage: string;
  count: number;
  percentage: number;
};

export async function getJobApplicationFunnel(
  owner_userid: string,
): Promise<JobApplicationFunnel[]> {
  const applications = extractJobApplications(await getUserJobApplications(owner_userid));
  const funnel = [
    { stage: 'Applied', count: applications.length },
    {
      stage: 'Response',
      count: applications.filter((application) => application.response_date).length,
    },
    {
      stage: 'Phone Screen',
      count: applications.filter(
        (application) =>
          application.status === 'PHONE_SCREEN' ||
          (application.interview_dates &&
            Array.isArray(application.interview_dates) &&
            application.interview_dates.length > 0),
      ).length,
    },
    {
      stage: 'Interview',
      count: applications.filter((application) => application.first_interview_date).length,
    },
    {
      stage: 'Final Round',
      count: applications.filter((application) => application.status === 'FINAL_INTERVIEW').length,
    },
    {
      stage: 'Offer',
      count: applications.filter(
        (application) => application.status === 'OFFER' || application.status === 'ACCEPTED',
      ).length,
    },
    {
      stage: 'Accepted',
      count: applications.filter((application) => application.status === 'ACCEPTED').length,
    },
  ];

  return funnel.map((stage) => ({
    ...stage,
    percentage: applications.length > 0 ? (stage.count / applications.length) * 100 : 0,
  }));
}

export type RecentApplication = JobApplicationWithCompany;

export async function getApplicationsByTimeframe(
  owner_userid: string,
  days = 30,
): Promise<RecentApplication[]> {
  const applications = extractJobApplications(await getUserJobApplications(owner_userid));
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return applications.filter(
    (application) =>
      application.application_date && new Date(application.application_date) >= cutoffDate,
  );
}

export type TopCompany = {
  company: string;
  count: number;
  offers: number;
  interviews: number;
  offerRate: number;
  interviewRate: number;
};

export async function getTopCompaniesAppliedTo(owner_userid: string, limit = 10) {
  const applications = extractJobApplications(await getUserJobApplications(owner_userid));
  const companyMap = new Map<string, { count: number; offers: number; interviews: number }>();

  for (const application of applications) {
    const companyName = application.company?.name || 'Unknown Company';
    const current = companyMap.get(companyName) || { count: 0, offers: 0, interviews: 0 };

    current.count++;
    if (application.status === 'OFFER' || application.status === 'ACCEPTED') current.offers++;
    if (application.first_interview_date) current.interviews++;
    companyMap.set(companyName, current);
  }

  return Array.from(companyMap.entries())
    .map(([company, data]) => ({
      company,
      ...data,
      offerRate: (data.offers / data.count) * 100,
      interviewRate: (data.interviews / data.count) * 100,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, limit);
}

export async function getAverageApplicationCycleTime(owner_userid: string): Promise<number> {
  const applications = extractJobApplications(await getUserJobApplications(owner_userid));
  const completedApps = applications.filter(
    (application) =>
      application.application_date &&
      application.decision_date &&
      (application.status === 'ACCEPTED' ||
        application.status === 'REJECTED' ||
        application.status === 'WITHDRAWN'),
  );

  if (completedApps.length === 0) return 0;

  const totalDays = completedApps.reduce((sum, application) => {
    if (!application.application_date || !application.decision_date) return sum;
    const start = new Date(application.application_date);
    const end = new Date(application.decision_date);
    return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, 0);

  return Math.round(totalDays / completedApps.length);
}

export async function getAllApplicationsWithCompany(
  owner_userid: string,
  filter?: JobApplicationFilter,
  pagination?: PaginationOptions,
): Promise<ApplicationWithCompany[]> {
  let applications = extractJobApplications(
    await getUserJobApplications(owner_userid),
  ) as ApplicationWithCompany[];

  if (filter?.status) {
    applications = applications.filter((application) => application.status === filter.status);
  }

  if (filter?.statuses?.length) {
    applications = applications.filter((application) =>
      filter.statuses?.includes(application.status),
    );
  }

  if (filter?.company_id) {
    applications = applications.filter(
      (application) => application.company_id === filter.company_id,
    );
  }

  if (filter?.source) {
    applications = applications.filter((application) => application.source === filter.source);
  }

  if (filter?.search) {
    const searchTerm = filter.search.toLowerCase();
    applications = applications.filter((application) => {
      const companyName = application.company?.name.toLowerCase() || '';
      return (
        application.position.toLowerCase().includes(searchTerm) ||
        companyName.includes(searchTerm) ||
        (application.location || '').toLowerCase().includes(searchTerm)
      );
    });
  }

  if (filter?.start_date) {
    applications = applications.filter(
      (application) =>
        application.application_date &&
        new Date(application.application_date) >= filter.start_date!,
    );
  }

  if (filter?.end_date) {
    applications = applications.filter(
      (application) =>
        application.application_date && new Date(application.application_date) <= filter.end_date!,
    );
  }

  const orderBy = pagination?.orderBy || 'application_date';
  const direction = pagination?.orderDirection === 'asc' ? 1 : -1;

  applications = [...applications].sort((left, right) => {
    const leftValue = (() => {
      switch (orderBy) {
        case 'response_date':
          return left.response_date ? new Date(left.response_date).getTime() : 0;
        case 'offer_date':
          return left.offer_date ? new Date(left.offer_date).getTime() : 0;
        case 'companyName':
          return left.company?.name.toLowerCase() || '';
        case 'position':
          return left.position.toLowerCase();
        case 'application_date':
        default:
          return left.application_date ? new Date(left.application_date).getTime() : 0;
      }
    })();

    const rightValue = (() => {
      switch (orderBy) {
        case 'response_date':
          return right.response_date ? new Date(right.response_date).getTime() : 0;
        case 'offer_date':
          return right.offer_date ? new Date(right.offer_date).getTime() : 0;
        case 'companyName':
          return right.company?.name.toLowerCase() || '';
        case 'position':
          return right.position.toLowerCase();
        case 'application_date':
        default:
          return right.application_date ? new Date(right.application_date).getTime() : 0;
      }
    })();

    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return 1 * direction;
    return 0;
  });

  const offset = pagination?.offset || 0;
  const limit = pagination?.limit || 1000;

  return applications.slice(offset, offset + limit);
}

export async function getJobApplicationMetricsForUser(
  owner_userid: string,
): Promise<JobApplicationMetrics> {
  const applications = extractJobApplications(await getUserJobApplications(owner_userid));
  return getJobApplicationMetrics(applications);
}

export const getAllApplicationsWithCompanyForUser = (owner_userid: string) =>
  getAllApplicationsWithCompany(owner_userid);
