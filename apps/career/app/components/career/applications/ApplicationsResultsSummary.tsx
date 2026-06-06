import { Button } from '@hominem/ui/button';

import type { ApplicationsResultsSummaryProps } from './types';

export function ApplicationsResultsSummary({
  page,
  limit,
  total,
  totalPages,
  onPrevPage,
  onNextPage,
  hasActiveFilters,
  onClearFilters,
}: ApplicationsResultsSummaryProps) {
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * limit, total);

  return (
    <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        {total === 0
          ? '0 applications'
          : `Showing ${rangeStart} to ${rangeEnd} of ${total} applications`}
      </span>

      <div className="flex items-center gap-4">
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="font-medium text-primary hover:text-primary/80"
          >
            Clear filters
          </button>
        ) : null}

        {totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={onPrevPage}
              disabled={page <= 1}
              variant="outline"
              size="sm"
            >
              Previous
            </Button>
            <span className="text-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              onClick={onNextPage}
              disabled={page >= totalPages}
              variant="outline"
              size="sm"
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
