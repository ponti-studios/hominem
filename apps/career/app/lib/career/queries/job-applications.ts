import { db } from '@hominem/db';

export type JobApplicationCard = {
  id: string;
  position: string;
  status: string;
  source: string | null;
  updatedat: string;
  applicationDate: string | null;
  company: { id: string; name: string } | null;
};

export type JobApplicationFilter = {
  status?: string;
  statuses?: string[];
  source?: string;
  search?: string;
};

export type PaginationOptions = {
  limit?: number;
  offset?: number;
  orderBy?: 'applicationDate' | 'companyName' | 'position';
  orderDirection?: 'asc' | 'desc';
};

export async function getApplicationCards(
  ownerUserid: string,
): Promise<JobApplicationCard[]> {
  const results = await db
    .selectFrom('app.jobApplications as ja')
    .leftJoin('app.companies as c', 'c.id', 'ja.companyId')
    .select([
      'ja.id',
      'ja.position',
      'ja.status',
      'ja.source',
      'ja.updatedat',
      'ja.applicationDate',
      'c.id as company_id',
      'c.name as company_name',
    ])
    .where('ja.ownerUserid', '=', ownerUserid)
    .orderBy('ja.applicationDate', 'desc')
    .execute();

  type Row = { id: string; position: string; status: string; source: string | null; updatedat: string; applicationDate: string | null; companyId: string | null; companyName: string | null };
  return (results as unknown as Row[]).map((row) => ({
    id: row.id,
    position: row.position,
    status: row.status,
    source: row.source,
    updatedat: String(row.updatedat),
    applicationDate: row.applicationDate ? String(row.applicationDate) : null,
    company: row.companyId
      ? { id: row.companyId, name: row.companyName ?? '' }
      : null,
  }));
}

export function filterJobApplications(
  applications: JobApplicationCard[],
  filter?: JobApplicationFilter,
): JobApplicationCard[] {
  if (!filter) return applications;

  let result = applications;

  if (filter.status) {
    result = result.filter((application) => application.status === filter.status);
  }

  if (filter.statuses?.length) {
    result = result.filter((application) => filter.statuses!.includes(application.status));
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
        companyName.includes(searchTerm)
      );
    });
  }

  return result;
}

export function sortAndPaginateJobApplications(
  applications: JobApplicationCard[],
  pagination?: PaginationOptions,
): JobApplicationCard[] {
  const orderBy = pagination?.orderBy || 'applicationDate';
  const direction = pagination?.orderDirection === 'asc' ? 1 : -1;

  const sorted = [...applications].sort((left, right) => {
    const leftValue = (() => {
      switch (orderBy) {
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
