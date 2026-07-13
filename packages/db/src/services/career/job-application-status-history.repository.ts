import type { Selectable } from 'kysely';

import type { DbHandle } from '../../transaction';
import type { AppJobApplicationStatusHistory } from '../../types/database';

type JobApplicationStatusHistoryRow = Selectable<AppJobApplicationStatusHistory>;

export interface JobApplicationStatusHistoryRecord {
  id: string;
  applicationId: string;
  previousStatus: string | null;
  newStatus: string;
  changedAt: string;
}

function toJobApplicationStatusHistoryRecord(
  row: JobApplicationStatusHistoryRow,
): JobApplicationStatusHistoryRecord {
  return {
    id: row.id,
    applicationId: row.applicationId,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    changedAt: String(row.changedAt),
  };
}

export const JobApplicationStatusHistoryRepository = {
  async listForApplications(
    handle: DbHandle,
    applicationIds: string[],
  ): Promise<JobApplicationStatusHistoryRecord[]> {
    if (applicationIds.length === 0) return [];

    const rows = await handle
      .selectFrom('app.jobApplicationStatusHistory')
      .selectAll()
      .where('applicationId', 'in', applicationIds)
      .orderBy('changedAt', 'desc')
      .execute();

    return (rows as JobApplicationStatusHistoryRow[]).map(toJobApplicationStatusHistoryRecord);
  },
};
