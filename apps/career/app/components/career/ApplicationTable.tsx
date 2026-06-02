import { Checkbox } from '@hominem/ui/checkbox';
import { FilterControls, FilterSelect } from '@hominem/ui/filters';
import { SearchInput } from '@hominem/ui/search-input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@hominem/ui/table';
import { PlusIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import {
  formatApplicationDate,
  formatApplicationSalary,
  formatStatusText,
  getCompanyName,
  getStatusColor,
  getUniqueSources,
  getUniqueStatuses,
  hasActiveFilters,
} from '~/lib/utils/applicationUtils';
import type { ApplicationWithCompany } from '~/types/applications';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FiltersInfo {
  search?: string;
  statuses?: string[];
  source?: string;
}

interface ApplicationTableProps {
  applications: ApplicationWithCompany[];
  pagination: PaginationInfo;
  filters: FiltersInfo;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function ApplicationTable({
  applications,
  pagination,
  filters,
  emptyTitle = 'No applications found',
  emptyDescription = 'Start tracking your job applications to see them here',
  className = '',
}: ApplicationTableProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Get unique statuses and sources from current applications for filter options
  const uniqueStatuses = getUniqueStatuses(applications);
  const uniqueSources = getUniqueSources(applications);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateSearchParams = (updates: Record<string, string | string[] | null>) => {
    const newSearchParams = new URLSearchParams(searchParams);

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
        newSearchParams.delete(key);
      } else if (Array.isArray(value)) {
        newSearchParams.delete(key);
        for (const v of value) {
          newSearchParams.append(key, v);
        }
      } else {
        newSearchParams.set(key, value);
      }
    }

    navigate(`?${newSearchParams.toString()}`);
  };

  const handleSearchChange = (search: string) => {
    updateSearchParams({ search: search || null, page: '1' });
  };

  const handleStatusToggle = (status: string) => {
    const currentStatuses = filters.statuses || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status];

    updateSearchParams({ status: newStatuses, page: '1' });
  };

  const handleSourceChange = (source: string) => {
    updateSearchParams({ source: source === 'ALL' ? null : source, page: '1' });
  };

  const handlePageChange = (page: number) => {
    updateSearchParams({ page: page.toString() });
  };

  const clearAllFilters = () => {
    updateSearchParams({ search: null, status: [], source: null, page: '1' });
  };

  const activeFilters = hasActiveFilters(filters);
  const filterChips = useMemo(() => {
    const chips = [];

    if (filters.search) {
      chips.push({
        id: 'search',
        label: `Search: ${filters.search}`,
        onRemove: () => updateSearchParams({ search: null, page: '1' }),
      });
    }

    for (const status of filters.statuses || []) {
      chips.push({
        id: `status:${status}`,
        label: formatStatusText(status),
        onRemove: () => handleStatusToggle(status),
      });
    }

    if (filters.source) {
      chips.push({
        id: 'source',
        label: `Source: ${filters.source}`,
        onRemove: () => updateSearchParams({ source: null, page: '1' }),
      });
    }

    return chips;
  }, [filters.search, filters.source, filters.statuses, handleStatusToggle]);

  if (!applications || applications.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <div className="text-4xl mb-4">📝</div>
        <p className="font-medium">{emptyTitle}</p>
        <p className="text-sm mt-1">{emptyDescription}</p>
        <Link
          to="/career/applications/create"
          className="btn-primary mt-4 inline-flex items-center gap-2"
        >
          <PlusIcon className="size-4" />
          Add Application
        </Link>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and Filter Section */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <FilterControls showActiveFilters={activeFilters} activeFilters={filterChips}>
          <div className="flex-1">
            <label htmlFor="search" className="mb-1 block text-sm font-medium text-gray-700">
              Search
            </label>
            <SearchInput
              value={filters.search || ''}
              onSearchChange={handleSearchChange}
              placeholder="Search by position or company..."
            />
          </div>

          <div className="relative sm:w-48" ref={statusDropdownRef}>
            <label
              htmlFor="status-dropdown"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Status ({(filters.statuses || []).length} selected)
            </label>
            <button
              id="status-dropdown"
              type="button"
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            >
              <span className="truncate">
                {!filters.statuses || filters.statuses.length === 0
                  ? 'All Statuses'
                  : filters.statuses.length === 1
                    ? formatStatusText(filters.statuses[0])
                    : `${filters.statuses.length} statuses`}
              </span>
              <svg
                className="h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isStatusDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg">
                <div className="max-h-60 overflow-auto py-1">
                  <div className="border-b border-gray-200 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => updateSearchParams({ status: [], page: '1' })}
                      className="font-medium text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Clear all
                    </button>
                    <span className="mx-2 text-gray-400">|</span>
                    <button
                      type="button"
                      onClick={() => updateSearchParams({ status: uniqueStatuses, page: '1' })}
                      className="font-medium text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Select all
                    </button>
                  </div>
                  {uniqueStatuses.map((status) => (
                    <label
                      key={status}
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={(filters.statuses || []).includes(status)}
                        onCheckedChange={() => handleStatusToggle(status)}
                        className="border-gray-300 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                      />
                      <span className="text-sm text-gray-900">{formatStatusText(status)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="sm:w-48">
            <FilterSelect
              label="Source"
              value={filters.source || ''}
              options={uniqueSources.map((source) => ({
                value: source || '',
                label: source || 'Unknown',
              }))}
              onChange={handleSourceChange}
              placeholder="All Sources"
              id="source-filter"
            />
          </div>
        </FilterControls>

        {/* Results Summary and Pagination Controls */}
        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{' '}
            applications
          </span>
          <div className="flex items-center gap-4">
            {activeFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear filters
              </button>
            )}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>

                <span className="text-gray-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table Section */}
      {applications.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">
          <div className="text-4xl mb-4">🔍</div>
          <p className="font-medium">
            {activeFilters ? 'No applications match your filters' : emptyTitle}
          </p>
          <p className="text-sm mt-1">
            {activeFilters ? 'Try adjusting your search criteria' : emptyDescription}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden rounded-lg border border-gray-200 bg-white shadow-sm md:block">
            <Table>
              <TableHeader className="bg-gray-50 [&_tr]:border-gray-200">
                <TableRow>
                  <TableHead className="px-6 text-xs uppercase tracking-wider text-gray-500">
                    Position
                  </TableHead>
                  <TableHead className="px-6 text-xs uppercase tracking-wider text-gray-500">
                    Status
                  </TableHead>
                  <TableHead className="px-6 text-xs uppercase tracking-wider text-gray-500">
                    Applied
                  </TableHead>
                  <TableHead className="px-6 text-xs uppercase tracking-wider text-gray-500">
                    Response
                  </TableHead>
                  <TableHead className="px-6 text-xs uppercase tracking-wider text-gray-500">
                    Salary
                  </TableHead>
                  <TableHead className="px-6 text-xs uppercase tracking-wider text-gray-500">
                    Source
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id} className="transition-colors hover:bg-gray-50">
                    <TableCell className="px-6 whitespace-nowrap">
                      <Link
                        to={`/career/applications/${app.id}`}
                        className="block hover:text-blue-600"
                      >
                        <div className="text-sm font-medium text-gray-900">{app.position}</div>
                        <div className="text-sm text-gray-500">{getCompanyName(app.company)}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="px-6 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(app.status)}`}
                      >
                        {formatStatusText(app.status)}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 whitespace-nowrap text-sm text-gray-900">
                      {formatApplicationDate(app.applicationDate || app.startDate || null)}
                    </TableCell>
                    <TableCell className="px-6 whitespace-nowrap text-sm text-gray-900">
                      {formatApplicationDate(app.responseDate)}
                    </TableCell>
                    <TableCell className="px-6 whitespace-nowrap text-sm text-gray-900">
                      {formatApplicationSalary(app.salaryOffered || app.salaryQuoted)}
                    </TableCell>
                    <TableCell className="px-6 whitespace-nowrap">
                      <span className="text-sm capitalize text-gray-500">{app.source || '—'}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile List View */}
          <div className="md:hidden bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="divide-y divide-gray-200">
              {applications.map((app) => (
                <Link
                  key={app.id}
                  to={`/career/applications/${app.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors duration-200 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {app.position}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {getCompanyName(app.company)}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center space-x-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(app.status)}`}
                      >
                        {formatStatusText(app.status)}
                      </span>
                      <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
