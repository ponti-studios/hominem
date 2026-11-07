import { humanizeIdentifier } from '@hominem/utils/text';
import { SectionIntro } from '@ponti-studios/ui/layout';
import { Button } from '@ponti-studios/ui/primitives';
import { BriefcaseBusinessIcon, FolderIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { AddButton } from '~/modules/career/components/AddButton';
import { ApplicationsFilters } from '~/modules/career/components/career/applications/ApplicationsFilters';
import { CareerCollection } from '~/modules/career/components/career/career-list';
import { StatusBadge } from '~/modules/career/components/status-badge';
import { buildStatusOptions } from '~/modules/career/lib/career/queries/job-applications';
import { createCareerServerClient } from '~/modules/career/lib/server-client';
import { isJobApplicationStatus } from '~/modules/career/lib/types/career';
import {
  formatApplicationDate,
  getApplicationStatusTone,
} from '~/modules/career/lib/utils/applicationUtils';

import { Route } from './+types/applications';

export const meta: Route.MetaFunction = () => [
  { title: 'Applications | Hominem' },
  { name: 'description', content: 'Track and manage your job applications in one place.' },
];

const PAGE_SIZE = 15;

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
  const sort = url.searchParams.get('sort') === 'asc' ? 'asc' : 'desc';
  const status = url.searchParams.get('status') ?? '';
  const query = (url.searchParams.get('query') ?? '').trim().toLowerCase();

  const response = await createCareerServerClient(request).applications.$get({
    query: status && isJobApplicationStatus(status) ? { status } : {},
  });
  const all = response.ok ? (await response.json()).applications : [];

  const filtered = query
    ? all.filter(
        (application) =>
          application.company.toLowerCase().includes(query) ||
          application.title.toLowerCase().includes(query),
      )
    : all;
  const sorted = [...filtered].sort((left, right) => {
    const leftKey = left.appliedAt ?? '';
    const rightKey = right.appliedAt ?? '';
    return sort === 'asc' ? leftKey.localeCompare(rightKey) : rightKey.localeCompare(leftKey);
  });

  const counts = new Map<string | null, number>();
  for (const application of all) {
    counts.set(application.status, (counts.get(application.status) ?? 0) + 1);
  }

  return {
    applications: sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: sorted.length,
    hasApplications: all.length > 0,
    statusOptions: buildStatusOptions(
      [...counts].map(([value, count]) => ({ status: value, count })),
    ),
  };
}

export default function ApplicationsRoute({
  loaderData,
}: Pick<Route.ComponentProps, 'loaderData'>) {
  const { applications, total, hasApplications, statusOptions } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();

  const statusFilter = searchParams.get('status') || '';
  const query = searchParams.get('query') || '';
  const sort = searchParams.get('sort') === 'asc' ? 'asc' : 'desc';
  const page = Number(searchParams.get('page') ?? '1') || 1;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'page') {
      next.delete('page');
    }
    setSearchParams(next, { preventScrollReset: true });
  };

  const toggleSort = () => setParam('sort', sort === 'desc' ? 'asc' : 'desc');

  const clearParams = (keys: string[]) => {
    const next = new URLSearchParams(searchParams);
    for (const key of keys) {
      next.delete(key);
    }
    next.delete('page');
    setSearchParams(next, { preventScrollReset: true });
  };

  const pageStart = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, total);

  return (
    <div>
      <SectionIntro
        title="Applications"
        actions={
          <AddButton asChild label="Add application">
            <Link to="/career/applications/new">
              <PlusIcon aria-hidden />
            </Link>
          </AddButton>
        }
      />

      {hasApplications && (
        <div className="mt-6">
          <ApplicationsFilters
            statusOptions={statusOptions}
            searchValue={query}
            onSearchChange={(v) => setParam('query', v)}
            selectedStatus={statusFilter}
            onStatusChange={(v) => setParam('status', v)}
            onClearFilters={() => clearParams(['status', 'query'])}
            sort={sort}
            onSortChange={toggleSort}
            pagination={{
              currentPage: currentPage - 1,
              totalPages,
              onPageChange: (p) => setParam('page', String(p + 1)),
            }}
          />
        </div>
      )}

      <CareerCollection
        className="mt-6"
        items={applications}
        keyFor={(app) => app.id}
        hrefFor={(app) => `/career/applications/${app.id}`}
        leading={() => (
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent-subtle text-accent sm:size-11">
            <BriefcaseBusinessIcon className="size-5" aria-hidden />
          </span>
        )}
        title={(app) => app.company}
        subtitle={(app) => app.title}
        meta={(app) => (app.appliedAt ? formatApplicationDate(app.appliedAt) : undefined)}
        trailing={(app) => (
          <div className="flex items-center gap-1.5">
            {app.status && (
              <StatusBadge
                tone={getApplicationStatusTone(app.status)}
                label={humanizeIdentifier(app.status)}
              />
            )}
            {app.hasOffer && <StatusBadge tone="success" label="Offer" />}
          </div>
        )}
        empty={
          !hasApplications
            ? {
                icon: <FolderIcon className="size-6" />,
                title: 'No applications yet',
                description:
                  'Applications will appear here once data is migrated from your warehouse.',
              }
            : {
                icon: <SearchIcon className="size-6" />,
                variant: 'search',
                title: 'No matching applications',
                description: 'Try adjusting your filters or search.',
                action: (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => clearParams(['status', 'query', 'sort'])}
                  >
                    Clear filters
                  </Button>
                ),
              }
        }
      />

      {applications.length > 0 && (
        <p className="footnote text-muted-foreground mt-4">
          Showing {pageStart}–{pageEnd} of {total}
        </p>
      )}
    </div>
  );
}
