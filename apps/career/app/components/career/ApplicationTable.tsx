import { Badge } from '@hominem/ui/badge';
import { Button, buttonVariants } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@hominem/ui/dropdown';
import { FilterControls, FilterSelect } from '@hominem/ui/filters';
import { SearchInput } from '@hominem/ui/search-input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@hominem/ui/table';
import { ChevronDownIcon, ChevronRightIcon, PlusIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { cn } from '~/lib/utils';
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

  const uniqueStatuses = getUniqueStatuses(applications);
  const uniqueSources = getUniqueSources(applications);

  const updateSearchParams = (updates: Record<string, string | string[] | null>) => {
    const newSearchParams = new URLSearchParams(searchParams);

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
        newSearchParams.delete(key);
      } else if (Array.isArray(value)) {
        newSearchParams.delete(key);
        for (const item of value) {
          newSearchParams.append(key, item);
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
      ? currentStatuses.filter((item) => item !== status)
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
  }, [filters.search, filters.source, filters.statuses]);

  if (!applications || applications.length === 0) {
    return (
      <div className={cn('py-8 text-center text-muted-foreground', className)}>
        <p className="font-medium text-foreground">{emptyTitle}</p>
        <p className="mt-1 text-sm">{emptyDescription}</p>
        <Link
          to="/career/applications/create"
          className={buttonVariants({
            variant: 'primary',
            size: 'md',
            className: 'mt-4 inline-flex gap-2',
          })}
        >
          <PlusIcon className="size-4" />
          Add Application
        </Link>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardContent className="p-4">
          <FilterControls showActiveFilters={activeFilters} activeFilters={filterChips}>
            <div className="flex-1">
              <label htmlFor="search" className="mb-1 block text-sm font-medium text-foreground">
                Search
              </label>
              <SearchInput
                value={filters.search || ''}
                onSearchChange={handleSearchChange}
                placeholder="Search by position or company..."
              />
            </div>

            <div className="sm:w-48">
              <label
                htmlFor="status-dropdown"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Status
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    id="status-dropdown"
                    type="button"
                    variant="outline"
                    className="w-full justify-between bg-background"
                  >
                    <span className="truncate">
                      {!filters.statuses || filters.statuses.length === 0
                        ? 'All Statuses'
                        : filters.statuses.length === 1
                          ? formatStatusText(filters.statuses[0])
                          : `${filters.statuses.length} statuses`}
                    </span>
                    <ChevronDownIcon className="size-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={() => updateSearchParams({ status: [], page: '1' })}>
                    Clear all
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateSearchParams({ status: uniqueStatuses, page: '1' })}
                  >
                    Select all
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {uniqueStatuses.map((status) => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={(filters.statuses || []).includes(status)}
                      onCheckedChange={() => handleStatusToggle(status)}
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

          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{' '}
              applications
            </span>
            <div className="flex items-center gap-4">
              {activeFilters ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="font-medium text-primary hover:text-primary/80"
                >
                  Clear filters
                </button>
              ) : null}

              {pagination.totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    variant="outline"
                    size="sm"
                    className="h-8"
                  >
                    Previous
                  </Button>

                  <span className="text-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>

                  <Button
                    type="button"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    variant="outline"
                    size="sm"
                    className="h-8"
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="font-medium text-foreground">
              {activeFilters ? 'No applications match your filters' : emptyTitle}
            </p>
            <p className="mt-1 text-sm">
              {activeFilters ? 'Try adjusting your search criteria' : emptyDescription}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden  md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => (
                    <TableRow key={app.id} className="hover:bg-muted/40">
                      <TableCell className="whitespace-nowrap">
                        <Link
                          to={`/career/applications/${app.id}`}
                          className="block hover:text-primary"
                        >
                          <div className="font-medium text-foreground">{app.position}</div>
                          <div className="text-muted-foreground">{getCompanyName(app.company)}</div>
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className={getStatusColor(app.status)}>
                          {formatStatusText(app.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatApplicationDate(app.application_date || app.start_date || null)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatApplicationDate(app.response_date)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatApplicationSalary(app.salary_offered || app.salary_quoted)}
                      </TableCell>
                      <TableCell>
                        <span className="capitalize text-muted-foreground">
                          {app.source || '—'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="md:hidden ">
            <CardContent className="divide-y divide-border p-0">
              {applications.map((app) => (
                <Link
                  key={app.id}
                  to={`/career/applications/${app.id}`}
                  className="block p-4 transition-colors duration-200 hover:bg-muted/40 focus:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-inset"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {app.position}
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        {getCompanyName(app.company)}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center space-x-3">
                      <Badge variant="outline" className={getStatusColor(app.status)}>
                        {formatStatusText(app.status)}
                      </Badge>
                      <ChevronRightIcon
                        className="h-5 w-5 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
