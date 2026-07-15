import type { ProjectRecord as Project, WorkExperienceRecord as WorkExperience } from '@hominem/db';
import { Badge, Button, EmptyState, FilterSelect, Input } from '@hominem/ui';
import { ChevronRightIcon, PlusIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { getUserWorkExperiencesDesc } from '~/lib/career/queries/base';
import { getProjectsByPortfolio } from '~/lib/career/queries/projects';
import { formatMonthYear } from '~/lib/career/work-experience-form';
import { portfolioContext, userContext } from '~/lib/middleware';

import { Route } from './+types/projects';

export const meta: Route.MetaFunction = () => [{ title: 'Projects | Craftd' }];

export interface ProjectClientOption {
  id: string;
  company: string;
  role: string;
}

function formatDateRange(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
) {
  return `${formatMonthYear(startDate) ?? 'Present'} - ${formatMonthYear(endDate) ?? 'Present'}`;
}

function formatStatusLabel(status: string | null | undefined) {
  if (!status) return '—';
  return status.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function buildProjectClientOptions(
  workExperiences: WorkExperience[],
): ProjectClientOption[] {
  return [...workExperiences]
    .sort((left, right) => (left.company || '').localeCompare(right.company || ''))
    .map((workExperience) => ({
      id: workExperience.id,
      company: workExperience.company?.trim() || 'Untitled client',
      role: workExperience.role?.trim() || '',
    }));
}

export function filterProjectsByClient(projects: Project[], selectedClientId?: string | null) {
  if (!selectedClientId) {
    return projects;
  }

  return projects.filter((project) => project.workExperienceId === selectedClientId);
}

export function filterProjectsBySearch(
  projects: Project[],
  search: string,
  clientLabelFor: (project: Project) => string,
) {
  const query = search.trim().toLowerCase();
  if (!query) {
    return projects;
  }

  return projects.filter((project) => {
    const title = project.title?.trim().toLowerCase() || '';
    const client = clientLabelFor(project).toLowerCase();
    return title.includes(query) || client.includes(query);
  });
}

function ProjectsHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="heading-2 text-foreground">Projects</h2>
      <Button type="button" onClick={onAdd} variant="outline" size="icon" aria-label="Add project">
        <PlusIcon className="size-4" />
      </Button>
    </div>
  );
}

function ProjectsFilters({
  searchValue,
  onSearchChange,
  clientOptions,
  selectedClientId,
  onClientChange,
  onClearFilters,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  clientOptions: ProjectClientOption[];
  selectedClientId: string;
  onClientChange: (clientId: string) => void;
  onClearFilters: () => void;
}) {
  const hasFilters = Boolean(searchValue.trim() || selectedClientId);
  const activeFilters = [
    ...(searchValue.trim()
      ? [
          {
            id: 'search',
            label: `Search: ${searchValue.trim()}`,
            onRemove: () => onSearchChange(''),
          },
        ]
      : []),
    ...(selectedClientId
      ? [
          {
            id: 'client',
            label: `Client: ${clientOptions.find((option) => option.id === selectedClientId)?.company || 'Selected'}`,
            onRemove: () => onClientChange(''),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1">
          <Input
            id="project-search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by project or client..."
            aria-label="Search projects"
          />
        </div>

        <div className="sm:w-48">
          <FilterSelect
            value={selectedClientId}
            options={clientOptions.map((option) => ({
              value: option.id,
              label: option.company,
            }))}
            onChange={onClientChange}
            placeholder="All clients"
            id="project-client-filter"
          />
        </div>

        {hasFilters ? (
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

function ProjectsDesktopTable({
  projects,
  clientLabelFor,
  hrefFor,
}: {
  projects: Project[];
  clientLabelFor: (project: Project) => string;
  hrefFor: (project: Project) => string;
}) {
  return (
    <div className="hidden md:block">
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.7fr)] gap-3 bg-muted/20 px-4 py-3 ui-data-label">
        <span>Project</span>
        <span>Client</span>
        <span>Timeline</span>
        <span>Status</span>
      </div>

      <ul className="divide-y divide-border">
        {projects.map((project) => (
          <li key={project.id} className="transition-colors duration-150">
            <Link
              to={hrefFor(project)}
              className="grid min-h-16 grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.7fr)] items-center gap-3 px-4 py-3"
            >
              <p className="body-2 truncate text-text-primary">
                {project.title?.trim() || 'Untitled project'}
              </p>
              <p className="body-2 truncate text-text-secondary">{clientLabelFor(project)}</p>
              <p className="body-4 whitespace-nowrap text-text-tertiary">
                {formatDateRange(project.startDate, project.endDate)}
              </p>
              <div>
                <Badge variant="outline">{formatStatusLabel(project.status)}</Badge>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProjectsMobileList({
  projects,
  clientLabelFor,
  hrefFor,
}: {
  projects: Project[];
  clientLabelFor: (project: Project) => string;
  hrefFor: (project: Project) => string;
}) {
  return (
    <div className="md:hidden">
      <ul className="divide-y divide-border">
        {projects.map((project) => (
          <li key={project.id} className="transition-colors duration-150">
            <Link to={hrefFor(project)} className="block p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="body-2 truncate text-text-primary">
                    {project.title?.trim() || 'Untitled project'}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="body-4 truncate text-text-secondary">{clientLabelFor(project)}</p>
                    <span className="body-4 text-text-tertiary">·</span>
                    <p className="body-4 text-text-tertiary">
                      {formatDateRange(project.startDate, project.endDate)}
                    </p>
                  </div>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <Badge variant="outline">{formatStatusLabel(project.status)}</Badge>
                  <ChevronRightIcon className="size-5 text-muted-foreground" aria-hidden="true" />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Projects({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState('');
  const selectedClientId = searchParams.get('client') || '';

  const clientOptions = useMemo(
    () => buildProjectClientOptions(loaderData.workExperiences),
    [loaderData.workExperiences],
  );
  const clientsById = useMemo(
    () =>
      new Map(
        clientOptions.map((workExperience) => [
          workExperience.id,
          workExperience.role
            ? `${workExperience.company} · ${workExperience.role}`
            : workExperience.company,
        ]),
      ),
    [clientOptions],
  );

  const clientLabelFor = (project: Project) =>
    clientsById.get(project.workExperienceId || '') || 'Unlinked project';

  const filteredProjects = useMemo(() => {
    const byClient = filterProjectsByClient(loaderData.projects, selectedClientId || null);
    return filterProjectsBySearch(byClient, searchValue, clientLabelFor);
  }, [loaderData.projects, selectedClientId, searchValue, clientsById]);

  const hasFilters = Boolean(searchValue.trim() || selectedClientId);
  const currentSearch = searchParams.toString();
  const newProjectHref = currentSearch ? `/projects/new?${currentSearch}` : '/projects/new';

  const hrefFor = (project: Project) =>
    currentSearch ? `/projects/${project.id}?${currentSearch}` : `/projects/${project.id}`;

  const handleClientChange = (clientId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (clientId) {
      nextParams.set('client', clientId);
    } else {
      nextParams.delete('client');
    }
    setSearchParams(nextParams);
  };

  const clearFilters = () => {
    setSearchValue('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('client');
    setSearchParams(nextParams);
  };

  return (
    <section className="flex flex-col gap-6">
      <ProjectsHeader onAdd={() => navigate(newProjectHref)} />

      <div className="flex flex-col gap-6">
        <ProjectsFilters
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          clientOptions={clientOptions}
          selectedClientId={selectedClientId}
          onClientChange={handleClientChange}
          onClearFilters={clearFilters}
        />

        {filteredProjects.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No projects match your filters' : 'No projects found'}
            description={
              hasFilters
                ? 'Try adjusting your search or client filter'
                : 'Add launches, case studies, and shipped work to edit them from a dedicated project page'
            }
            variant={hasFilters ? 'search' : 'dashed'}
            size={hasFilters ? 'md' : undefined}
          />
        ) : (
          <>
            <ProjectsDesktopTable
              projects={filteredProjects}
              clientLabelFor={clientLabelFor}
              hrefFor={hrefFor}
            />
            <ProjectsMobileList
              projects={filteredProjects}
              clientLabelFor={clientLabelFor}
              hrefFor={hrefFor}
            />
          </>
        )}
      </div>
    </section>
  );
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  const portfolio = context.get(portfolioContext)!;
  const [projects, workExperiences] = await Promise.all([
    getProjectsByPortfolio(portfolio.id),
    getUserWorkExperiencesDesc(user.id),
  ]);

  return { projects, workExperiences };
}
