import {
  db,
  JobApplicationRepository,
  type JobApplicationRecord as ApplicationWithCompany,
} from '@hominem/db';

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

export async function getAllApplicationsWithCompany(
  ownerUserid: string,
): Promise<ApplicationWithCompany[]> {
  return JobApplicationRepository.listUserJobApplicationsWithCompany(db, ownerUserid);
}

export function filterJobApplications(
  applications: ApplicationWithCompany[],
  filter?: JobApplicationFilter,
): ApplicationWithCompany[] {
  if (!filter) return applications;

  let result = applications;

  if (filter.status) {
    result = result.filter((application) => application.status === filter.status);
  }

  if (filter.statuses?.length) {
    result = result.filter((application) => filter.statuses!.includes(application.status));
  }

  if (filter.companyId) {
    result = result.filter((application) => application.companyId === filter.companyId);
  }

  if (filter.source) {
    result = result.filter((application) => application.source === filter.source);
  }

  if (filter.search) {
    const searchTerm = filter.search.toLowerCase();
    result = result.filter((application) => {
      const companyName = application.company?.name.toLowerCase() || '';
      return (
        application.position.toLowerCase().includes(searchTerm) ||
        companyName.includes(searchTerm) ||
        (application.location || '').toLowerCase().includes(searchTerm)
      );
    });
  }

  if (filter.startDate) {
    result = result.filter(
      (application) =>
        application.applicationDate && new Date(application.applicationDate) >= filter.startDate!,
    );
  }

  if (filter.endDate) {
    result = result.filter(
      (application) =>
        application.applicationDate && new Date(application.applicationDate) <= filter.endDate!,
    );
  }

  return result;
}

export function sortAndPaginateJobApplications(
  applications: ApplicationWithCompany[],
  pagination?: PaginationOptions,
): ApplicationWithCompany[] {
  const orderBy = pagination?.orderBy || 'applicationDate';
  const direction = pagination?.orderDirection === 'asc' ? 1 : -1;

  const sorted = [...applications].sort((left, right) => {
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

  return sorted.slice(offset, offset + limit);
}
