import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  FilterSelect,
  Input,
} from '@hominem/ui';
import { ChevronDownIcon, XIcon } from 'lucide-react';

import { formatStatusText } from '~/lib/utils/applicationUtils';

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1">
          <Input
            id="application-search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by position or company..."
            aria-label="Search applications"
          />
        </div>

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

        {activeFilters.length > 0 ? (
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
      </div>

      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <Button
              key={filter.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={filter.onRemove}
              className="h-8 gap-2 border-dashed"
            >
              <span>{filter.label}</span>
              <XIcon className="size-3.5" />
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
