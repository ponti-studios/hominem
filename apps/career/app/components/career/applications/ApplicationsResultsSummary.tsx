import { Button } from '@hominem/ui';

import type { ApplicationsResultsSummaryProps } from './types';

export function ApplicationsResultsSummary({
  page,
  limit,
  total,
  totalPages,
  onPrevPage,
  onNextPage,
}: ApplicationsResultsSummaryProps) {
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * limit, total);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 body-3 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span className="body-4 text-muted-foreground">
        {total === 0
          ? '0 applications'
          : `Showing ${rangeStart} to ${rangeEnd} of ${total} applications`}
      </span>

      <div className="flex items-center gap-4">
        {totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={onPrevPage}
              disabled={page <= 1}
              variant="outline"
              size="sm"
              className="border-dashed"
            >
              Previous
            </Button>
            <span className="body-4 text-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              onClick={onNextPage}
              disabled={page >= totalPages}
              variant="outline"
              size="sm"
              className="border-dashed"
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
