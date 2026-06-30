import type { ReactNode } from "react";

import { ActiveFiltersBar, type ActiveFilter } from "./active-filters-bar";

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
      <div className="flex flex-1 items-end gap-3">{children}</div>
      {showActiveFilters && activeFilters.length > 0 ? (
        <ActiveFiltersBar filters={activeFilters} />
      ) : null}
    </div>
  );
}
