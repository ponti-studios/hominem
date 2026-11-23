import { humanizeIdentifier } from '@hominem/utils/text';

import { JOB_APPLICATION_STATUSES } from '~/modules/career/lib/types/career';

export type FilterOption = { value: string; label: string };

const NO_STATUS_FILTER = '__no_status__';

export type StatusCount = { status: string | null; count: number };

export function buildStatusOptions(statusCounts: StatusCount[]): FilterOption[] {
  const counts = new Map(statusCounts.map((entry) => [entry.status, entry.count]));
  const noStatus = counts.get(null) ?? 0;
  return [
    ...JOB_APPLICATION_STATUSES.map((status) => ({
      value: status,
      label: `${humanizeIdentifier(status)} (${counts.get(status) ?? 0})`,
    })),
    ...(noStatus > 0 ? [{ value: NO_STATUS_FILTER, label: `No status (${noStatus})` }] : []),
  ];
}

export type SortDirection = 'asc' | 'desc';
