import { Button } from "@hominem/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@hominem/ui/dropdown";
import { FilterControls, FilterSelect } from "@hominem/ui/filters";
import { Input } from "@hominem/ui/input";
import { ChevronDownIcon } from "lucide-react";

import { formatStatusText } from "~/lib/utils/applicationUtils";

import type { ApplicationsFiltersProps } from "./types";

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
            id: "search",
            label: `Search: ${searchValue}`,
            onRemove: () => onSearchChange(""),
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
            id: "source",
            label: `Source: ${selectedSource}`,
            onRemove: () => onSourceChange(""),
          },
        ]
      : []),
  ];

  return (
    <FilterControls
      showActiveFilters={activeFilters.length > 0}
      activeFilters={activeFilters}
    >
      <div className="flex-1">
        <label
          htmlFor="application-search"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          Search
        </label>
        <Input
          id="application-search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by position or company..."
        />
      </div>

      <div className="sm:w-48">
        <label
          htmlFor="application-status-dropdown"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          Status
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              id="application-status-dropdown"
              type="button"
              variant="outline"
              className="w-full justify-between bg-background"
            >
              <span className="truncate">
                {selectedStatuses.length === 0
                  ? "All Statuses"
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
          label="Source"
          value={selectedSource}
          options={sourceOptions}
          onChange={onSourceChange}
          placeholder="All Sources"
          id="application-source-filter"
        />
      </div>

      {activeFilters.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          onClick={onClearFilters}
          className="border-dashed"
        >
          Clear Filters
        </Button>
      ) : null}
    </FilterControls>
  );
}
