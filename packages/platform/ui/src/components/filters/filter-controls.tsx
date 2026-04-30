import type { ReactNode } from 'react';

import { type ActiveFilter, ActiveFiltersBar } from './active-filters-bar';

export interface FilterControlsProps {
  children: ReactNode;
  showActiveFilters?: boolean;
  activeFilters?: ActiveFilter[];
}

export function FilterControls({
  children,
  showActiveFilters = false,
  activeFilters = [],
}: FilterControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3 flex-1">{children}</div>
      {showActiveFilters && activeFilters.length > 0 && (
        <ActiveFiltersBar filters={activeFilters} />
      )}
    </div>
  );
}
