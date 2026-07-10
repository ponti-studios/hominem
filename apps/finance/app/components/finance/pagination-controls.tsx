import { Button } from '@hominem/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="body-3 flex items-center justify-end gap-2 text-muted-foreground">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-dashed"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 0}
      >
        <ChevronLeft className="size-4" aria-hidden />
        Previous
      </Button>
      <span className="body-4 text-foreground">
        Page {currentPage + 1} of {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-dashed"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages - 1}
      >
        Next
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
