import { db, JobApplicationRepository } from '@hominem/db';
import { Button, useDebouncedValue } from '@hominem/ui';
import { PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { ApplicationsDesktopTable } from '~/components/career/applications/ApplicationsDesktopTable';
import { ApplicationsEmptyState } from '~/components/career/applications/ApplicationsEmptyState';
import { ApplicationsFilters } from '~/components/career/applications/ApplicationsFilters';
import { ApplicationsMobileList } from '~/components/career/applications/ApplicationsMobileList';
import { ApplicationsResultsSummary } from '~/components/career/applications/ApplicationsResultsSummary';
import { getAllApplicationsWithCompany } from '~/lib/career/queries/job-applications';
import { userContext } from '~/lib/middleware';
import { buildApplicationsSearchParams } from '~/lib/utils/applicationsSearchParams';
import {
  getUniqueSources,
  getUniqueStatuses,
  hasActiveFilters,
} from '~/lib/utils/applicationUtils';
import type { JobApplicationStatus } from '~/types/career';

import { Route } from './+types/applications';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Extract pagination and filter parameters
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1'));
    const limit = Math.max(
      1,
      Math.min(MAX_LIMIT, Number.parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT))),
    );
    const offset = (page - 1) * limit;

    const searchQuery = searchParams.get('search') || undefined;
    const selectedStatuses = searchParams.getAll('status').filter(Boolean);
    const source = searchParams.get('source') || undefined;

    // Build filter object
    const filter = {
      ...(selectedStatuses.length > 0 && { statuses: selectedStatuses }),
      ...(source && source !== 'ALL' && { source }),
      ...(searchQuery && { search: searchQuery }),
    };

    // Build pagination object
    const pagination = {
      limit,
      offset,
      orderBy: (searchParams.get('orderBy') || 'applicationDate') as
        | 'applicationDate'
        | 'responseDate'
        | 'offerDate'
        | 'companyName'
        | 'position',
      orderDirection: (searchParams.get('orderDirection') as 'asc' | 'desc') || 'desc',
    };

    const [allApplications, paginatedApplications, filteredApplications] = await Promise.all([
      getAllApplicationsWithCompany(user.id),
      getAllApplicationsWithCompany(user.id, filter, pagination),
      getAllApplicationsWithCompany(user.id, filter),
    ]);

    return {
      user,
      allApplications,
      applications: paginatedApplications,
      pagination: {
        page,
        limit,
        total: filteredApplications.length,
        totalPages: Math.ceil(filteredApplications.length / limit),
      },
      filters: {
        search: searchQuery,
        statuses: selectedStatuses,
        source: source && source !== 'ALL' ? source : undefined,
      },
    };
  } catch (error) {
    console.error('Error loading job applications data:', error);
    throw new Response('Failed to load job applications data', { status: 500 });
  }
}

export async function action({ context, request }: Route.ActionArgs) {
  const user = context.get(userContext)!;
  try {
    const formData = await request.formData();
    const operation = formData.get('operation');

    if (typeof operation !== 'string') {
      throw new Response('Invalid operation', { status: 400 });
    }

    if (operation === 'update') {
      const applicationId = formData.get('applicationId');
      const status = formData.get('status');

      if (typeof applicationId !== 'string' || typeof status !== 'string') {
        throw new Response('Missing or invalid applicationId or status', { status: 400 });
      }

      await JobApplicationRepository.updateJobApplicationStatus(
        db,
        user.id,
        applicationId,
        status as JobApplicationStatus,
      );

      return { message: 'Job application updated successfully' };
    }

    if (operation === 'delete') {
      const applicationId = formData.get('applicationId');

      if (typeof applicationId !== 'string') {
        throw new Response('Missing or invalid applicationId', { status: 400 });
      }

      await JobApplicationRepository.deleteJobApplication(db, user.id, applicationId);

      return { message: 'Job application deleted successfully' };
    }

    throw new Response('Invalid operation', { status: 400 });
  } catch (error) {
    console.error('Error in job applications action:', error);
    throw new Response('Failed to process job application request', { status: 500 });
  }
}

function ApplicationsHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="heading-2 text-foreground">Job Applications</h2>
      <Button
        type="button"
        onClick={onAdd}
        variant="outline"
        size="icon"
        aria-label="Add application"
      >
        <PlusIcon className="size-4" />
      </Button>
    </div>
  );
}

export default function Applications({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchValueFromRoute = loaderData.filters.search || '';
  const [searchValue, setSearchValue] = useState(searchValueFromRoute);
  const debouncedSearchValue = useDebouncedValue(searchValue, 500);

  const { allApplications, applications, pagination, filters: initialFilters } = loaderData;
  const filters = {
    ...initialFilters,
    statuses: initialFilters.statuses ?? [],
    source: initialFilters.source ?? '',
  };
  const statuses = getUniqueStatuses(allApplications);
  const sourceOptions = getUniqueSources(allApplications).map((source) => ({
    value: source,
    label: source || 'Unknown',
  }));
  const hasFilters = hasActiveFilters(filters);

  const updateSearchParams = (updates: Record<string, string | string[] | null>) => {
    const nextSearchParams = buildApplicationsSearchParams(searchParams, updates);
    const queryString = nextSearchParams.toString();
    navigate(queryString ? `?${queryString}` : '.');
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (value === '') {
      updateSearchParams({ search: null, page: '1' });
    }
  };

  const handleStatusToggle = (status: string) => {
    const nextStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((item: string) => item !== status)
      : [...filters.statuses, status];
    updateSearchParams({ status: nextStatuses, page: '1' });
  };

  const handleSourceChange = (source: string) => {
    updateSearchParams({ source: source || null, page: '1' });
  };

  const clearFilters = () => {
    setSearchValue('');
    updateSearchParams({ search: null, status: [], source: null, page: '1' });
  };

  useEffect(() => {
    setSearchValue(filters.search || '');
  }, [filters.search]);

  useEffect(() => {
    if (debouncedSearchValue === (filters.search || '') || debouncedSearchValue === '') {
      return;
    }
    updateSearchParams({ search: debouncedSearchValue, page: '1' });
  }, [debouncedSearchValue, filters.search]);

  return (
    <section className="flex flex-col gap-6">
      <ApplicationsHeader onAdd={() => navigate('/applications/new')} />

      <div className="space-y-8">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="p-4">
            <ApplicationsFilters
              searchValue={searchValue}
              onSearchChange={handleSearchChange}
              statuses={statuses}
              selectedStatuses={filters.statuses}
              onStatusToggle={handleStatusToggle}
              sourceOptions={sourceOptions}
              selectedSource={filters.source}
              onSourceChange={handleSourceChange}
              onClearFilters={clearFilters}
            />

            <ApplicationsResultsSummary
              page={pagination.page}
              limit={pagination.limit}
              total={pagination.total}
              totalPages={pagination.totalPages}
              onPrevPage={() => updateSearchParams({ page: String(pagination.page - 1) })}
              onNextPage={() => updateSearchParams({ page: String(pagination.page + 1) })}
            />
          </div>

          {applications.length === 0 ? (
            <div className="px-6 py-10 sm:px-8">
              <ApplicationsEmptyState
                kind={hasFilters ? 'filtered' : 'base'}
                emptyTitle={
                  hasFilters ? 'No applications match your filters' : 'No applications found'
                }
                emptyDescription={
                  hasFilters
                    ? 'Try adjusting your search criteria'
                    : 'Start tracking your job applications to see them here'
                }
              />
            </div>
          ) : (
            <>
              <ApplicationsDesktopTable applications={applications} />
              <ApplicationsMobileList applications={applications} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
