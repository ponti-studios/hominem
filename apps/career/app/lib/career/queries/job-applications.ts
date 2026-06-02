import type { ApplicationWithCompany, JobApplicationMetrics } from '~/types/career-data';

import {
  extractJobApplications,
  getUserJobApplications,
  type JobApplicationWithCompany,
} from './base';
import { calculatePercentageChange } from './utils';

export type JobApplicationFilter = {
  status?: string;
  statuses?: string[];
  companyId?: string;
  source?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  salaryMin?: number;
  salaryMax?: number;
};

export type PaginationOptions = {
  limit?: number;
  offset?: number;
  orderBy?: 'applicationDate' | 'responseDate' | 'offerDate' | 'companyName' | 'position';
  orderDirection?: 'asc' | 'desc';
};

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
  const responsesReceived = applications.filter((application) => application.responseDate).length;
  const interviewsScheduled = applications.filter(
    (application) => application.firstInterviewDate,
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
  const timeToResponseApps = applications.filter((application) => application.timeToResponse);
  const timeToOfferApps = applications.filter((application) => application.timeToOffer);
  const timeToDecisionApps = applications.filter((application) => application.timeToDecision);

  return {
    averageTimeToResponse:
      timeToResponseApps.length > 0
        ? timeToResponseApps.reduce(
            (sum, application) => sum + (application.timeToResponse || 0),
            0,
          ) / timeToResponseApps.length
        : 0,
    averageTimeToOffer:
      timeToOfferApps.length > 0
        ? timeToOfferApps.reduce((sum, application) => sum + (application.timeToOffer || 0), 0) /
          timeToOfferApps.length
        : 0,
    averageTimeToDecision:
      timeToDecisionApps.length > 0
        ? timeToDecisionApps.reduce(
            (sum, application) => sum + (application.timeToDecision || 0),
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
    .filter((application): application is typeof application & { salaryOffered: number } =>
      Boolean(application.salaryOffered),
    )
    .map((application) => application.salaryOffered);
  const acceptedSalaries = applications
    .filter((application): application is typeof application & { salaryFinal: number } =>
      Boolean(application.salaryFinal),
    )
    .map((application) => application.salaryFinal);
  const negotiatedApps = applications.filter(
    (application) =>
      application.salaryOffered &&
      application.salaryNegotiated &&
      application.salaryNegotiated > application.salaryOffered,
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
            if (!application.salaryOffered || !application.salaryNegotiated) return sum;
            return (
              sum +
              calculatePercentageChange(application.salaryOffered, application.salaryNegotiated)
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
    if (application.responseDate) current.responses++;
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

export async function getJobApplicationFunnel(userId: string): Promise<JobApplicationFunnel[]> {
  const applications = extractJobApplications(await getUserJobApplications(userId));
  const funnel = [
    { stage: 'Applied', count: applications.length },
    {
      stage: 'Response',
      count: applications.filter((application) => application.responseDate).length,
    },
    {
      stage: 'Phone Screen',
      count: applications.filter(
        (application) =>
          application.status === 'PHONE_SCREEN' ||
          (application.interviewDates &&
            Array.isArray(application.interviewDates) &&
            application.interviewDates.length > 0),
      ).length,
    },
    {
      stage: 'Interview',
      count: applications.filter((application) => application.firstInterviewDate).length,
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
  userId: string,
  days = 30,
): Promise<RecentApplication[]> {
  const applications = extractJobApplications(await getUserJobApplications(userId));
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return applications.filter(
    (application) =>
      application.applicationDate && new Date(application.applicationDate) >= cutoffDate,
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

export async function getTopCompaniesAppliedTo(userId: string, limit = 10) {
  const applications = extractJobApplications(await getUserJobApplications(userId));
  const companyMap = new Map<string, { count: number; offers: number; interviews: number }>();

  for (const application of applications) {
    const companyName = application.company?.name || 'Unknown Company';
    const current = companyMap.get(companyName) || { count: 0, offers: 0, interviews: 0 };

    current.count++;
    if (application.status === 'OFFER' || application.status === 'ACCEPTED') current.offers++;
    if (application.firstInterviewDate) current.interviews++;
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

export async function getAverageApplicationCycleTime(userId: string): Promise<number> {
  const applications = extractJobApplications(await getUserJobApplications(userId));
  const completedApps = applications.filter(
    (application) =>
      application.applicationDate &&
      application.decisionDate &&
      (application.status === 'ACCEPTED' ||
        application.status === 'REJECTED' ||
        application.status === 'WITHDRAWN'),
  );

  if (completedApps.length === 0) return 0;

  const totalDays = completedApps.reduce((sum, application) => {
    if (!application.applicationDate || !application.decisionDate) return sum;
    const start = new Date(application.applicationDate);
    const end = new Date(application.decisionDate);
    return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, 0);

  return Math.round(totalDays / completedApps.length);
}

export async function getAllApplicationsWithCompany(
  userId: string,
  filter?: JobApplicationFilter,
  pagination?: PaginationOptions,
): Promise<ApplicationWithCompany[]> {
  let applications = extractJobApplications(
    await getUserJobApplications(userId),
  ) as ApplicationWithCompany[];

  if (filter?.status) {
    applications = applications.filter((application) => application.status === filter.status);
  }

  if (filter?.statuses?.length) {
    applications = applications.filter((application) =>
      filter.statuses?.includes(application.status),
    );
  }

  if (filter?.companyId) {
    applications = applications.filter((application) => application.companyId === filter.companyId);
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

  if (filter?.startDate) {
    applications = applications.filter(
      (application) =>
        application.applicationDate && new Date(application.applicationDate) >= filter.startDate!,
    );
  }

  if (filter?.endDate) {
    applications = applications.filter(
      (application) =>
        application.applicationDate && new Date(application.applicationDate) <= filter.endDate!,
    );
  }

  const orderBy = pagination?.orderBy || 'applicationDate';
  const direction = pagination?.orderDirection === 'asc' ? 1 : -1;

  applications = [...applications].sort((left, right) => {
    const leftValue = (() => {
      switch (orderBy) {
        case 'responseDate':
          return left.responseDate ? new Date(left.responseDate).getTime() : 0;
        case 'offerDate':
          return left.offerDate ? new Date(left.offerDate).getTime() : 0;
        case 'companyName':
          return left.company?.name.toLowerCase() || '';
        case 'position':
          return left.position.toLowerCase();
        case 'applicationDate':
        default:
          return left.applicationDate ? new Date(left.applicationDate).getTime() : 0;
      }
    })();

    const rightValue = (() => {
      switch (orderBy) {
        case 'responseDate':
          return right.responseDate ? new Date(right.responseDate).getTime() : 0;
        case 'offerDate':
          return right.offerDate ? new Date(right.offerDate).getTime() : 0;
        case 'companyName':
          return right.company?.name.toLowerCase() || '';
        case 'position':
          return right.position.toLowerCase();
        case 'applicationDate':
        default:
          return right.applicationDate ? new Date(right.applicationDate).getTime() : 0;
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
  userId: string,
): Promise<JobApplicationMetrics> {
  const applications = extractJobApplications(await getUserJobApplications(userId));
  return getJobApplicationMetrics(applications);
}

export const getAllApplicationsWithCompanyForUser = (userId: string) =>
  getAllApplicationsWithCompany(userId);
