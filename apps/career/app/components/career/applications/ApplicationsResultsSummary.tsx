import { Button } from '@hominem/ui';

import type { ApplicationsResultsSummaryProps } from './types';

export function ApplicationsResultsSummary({
  page,
  totalPages,
  onPrevPage,
  onNextPage,
}: ApplicationsResultsSummaryProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-2 body-3 text-muted-foreground">
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
  );
}
