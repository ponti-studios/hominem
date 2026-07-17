import { Input } from '@ponti-studios/ui/forms';
import { Button } from '@ponti-studios/ui/primitives';
import { XIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { ActiveFiltersBar, type ActiveFilter } from './active-filters-bar';

export interface SearchFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel: string;
  searchId?: string;
  /** Extra filter controls (e.g. FilterSelect, status dropdown) rendered next to the search input. */
  filters?: ReactNode;
  activeFilters: ActiveFilter[];
  onClearFilters: () => void;
  /** Non-filter content (e.g. a results summary) placed at the end of the control row. */
  resultsSlot?: ReactNode;
}

export function SearchFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  searchId,
  filters,
  activeFilters,
  onClearFilters,
  resultsSlot,
}: SearchFilterBarProps) {
  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1">
          <Input
            id={searchId}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
          />
        </div>

        {filters}

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onClearFilters}
            className="gap-2 self-start lg:self-auto"
          >
            <XIcon className="size-4" />
            Clear filters
          </Button>
        ) : null}

        {resultsSlot ? (
          <div className="self-start lg:ml-auto lg:self-auto">{resultsSlot}</div>
        ) : null}
      </div>

      <ActiveFiltersBar filters={activeFilters} />
    </div>
  );
}
