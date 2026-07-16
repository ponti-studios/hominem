import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@ponti-studios/ui/overlays';
import { Button } from '@ponti-studios/ui/primitives';
import { ChevronDownIcon } from 'lucide-react';

import { FilterSelect, SearchFilterBar } from '~/components/patterns';
import { formatStatusText } from '~/lib/utils/applicationUtils';

import { ApplicationsResultsSummary } from './ApplicationsResultsSummary';
import type { ApplicationsFiltersProps } from './types';

export function ApplicationsFilters({
  searchValue,
  onSearchChange,
  statuses,
  selectedStatuses,
  onStatusToggle,
  sourceOptions,
  selectedSource,
  onSourceChange,
  onClearFilters,
  pagination,
}: ApplicationsFiltersProps) {
  const activeFilters = [
    ...(searchValue
      ? [
          {
            id: 'search',
            label: `Search: ${searchValue}`,
            onRemove: () => onSearchChange(''),
          },
        ]
      : []),
    ...selectedStatuses.map((status) => ({
      id: `status:${status}`,
      label: formatStatusText(status),
      onRemove: () => onStatusToggle(status),
    })),
    ...(selectedSource
      ? [
          {
            id: 'source',
            label: `Source: ${selectedSource}`,
            onRemove: () => onSourceChange(''),
          },
        ]
      : []),
  ];

  return (
    <SearchFilterBar
      searchId="application-search"
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by position or company..."
      searchAriaLabel="Search applications"
      activeFilters={activeFilters}
      onClearFilters={onClearFilters}
      resultsSlot={<ApplicationsResultsSummary {...pagination} />}
      filters={
        <>
          <div className="sm:w-48">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  id="application-status-dropdown"
                  type="button"
                  variant="outline"
                  className="w-full justify-between bg-background"
                  aria-label="Filter by status"
                >
                  <span className="truncate">
                    {selectedStatuses.length === 0
                      ? 'All statuses'
                      : selectedStatuses.length === 1
                        ? formatStatusText(selectedStatuses[0])
                        : `${selectedStatuses.length} statuses`}
                  </span>
                  <ChevronDownIcon className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {statuses.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={selectedStatuses.includes(status)}
                    onCheckedChange={() => onStatusToggle(status)}
                  >
                    {formatStatusText(status)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="sm:w-48">
            <FilterSelect
              value={selectedSource}
              options={sourceOptions}
              onChange={onSourceChange}
              placeholder="All sources"
              id="application-source-filter"
            />
          </div>
        </>
      }
    />
  );
}
