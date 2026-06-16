import type {
  CareerProjectRecord as Project,
  CareerWorkExperienceRecord as WorkExperience,
} from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@hominem/ui/select';
import { FolderOpenIcon, PencilLineIcon, PlusIcon, XIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { getUserWorkExperiencesDesc } from '~/lib/career/queries/base';
import { getProjectsByPortfolio } from '~/lib/career/queries/projects';
import { portfolioContext, userContext } from '~/lib/middleware';

import { Route } from './+types/projects';

export const meta: Route.MetaFunction = () => [{ title: 'Projects | Craftd' }];

export interface ProjectClientOption {
  id: string;
  company: string;
  role: string;
}

function formatMonthYear(date: Date | string | null | undefined) {
  if (!date) return 'Present';

  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
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

  return projects.filter((project) => project.work_experience_id === selectedClientId);
}

function ProjectSummaryCard({
  project,
  clientLabel,
  onEdit,
}: {
  project: Project;
  clientLabel: string;
  onEdit: (id: string) => void;
}) {
  return (
    <li className="transition-colors duration-150">
      <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_auto_auto]">
        <div className="min-w-0">
          <p className="body-2 truncate text-text-primary">
            {project.title?.trim() || 'Untitled project'}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:hidden">
            <p className="body-4 truncate text-text-secondary">{clientLabel}</p>
            <span className="body-4 text-text-tertiary">·</span>
            <p className="body-4 text-text-tertiary">
              {formatMonthYear(project.start_date)} - {formatMonthYear(project.end_date)}
            </p>
          </div>
        </div>

        <p className="body-2 hidden truncate text-text-secondary md:block">{clientLabel}</p>

        <p className="body-4 hidden whitespace-nowrap text-text-tertiary md:block">
          {formatMonthYear(project.start_date)} - {formatMonthYear(project.end_date)}
        </p>

        <Button
          type="button"
          onClick={() => onEdit(project.id)}
          variant="ghost"
          size="icon"
          className="h-11 w-11 justify-self-end text-text-secondary"
          aria-label={`Edit ${project.title?.trim() || 'project'}`}
        >
          <PencilLineIcon className="size-4" />
        </Button>
      </div>
    </li>
  );
}

export default function Projects({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedClientId = searchParams.get('client');
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
  const filteredProjects = useMemo(
    () => filterProjectsByClient(loaderData.projects, selectedClientId),
    [loaderData.projects, selectedClientId],
  );
  const selectedClient = clientOptions.find(
    (workExperience) => workExperience.id === selectedClientId,
  );
  const currentSearch = searchParams.toString();
  const newProjectHref = currentSearch ? `/projects/new?${currentSearch}` : '/projects/new';

  const handleClientChange = (clientId: string | null) => {
    const nextParams = new URLSearchParams(searchParams);

    if (clientId) {
      nextParams.set('client', clientId);
    } else {
      nextParams.delete('client');
    }

    setSearchParams(nextParams);
  };

  const clearClientFilter = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('client');
    setSearchParams(nextParams);
  };

  const projectCountLabel = selectedClient
    ? `${filteredProjects.length} project${filteredProjects.length === 1 ? '' : 's'} for ${selectedClient.company}`
    : `${loaderData.projects.length} total project${loaderData.projects.length === 1 ? '' : 's'}`;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="heading-2 text-foreground">Projects</h2>
        <Button
          type="button"
          onClick={() => navigate(newProjectHref)}
          variant="outline"
          size="icon"
          aria-label="Add new project"
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-col gap-2">
              <label
                htmlFor="project-client-filter"
                className="subheading-4 text-muted-foreground"
              >
                Client
              </label>
              <Select value={selectedClientId ?? ''} onValueChange={handleClientChange}>
                <SelectTrigger id="project-client-filter" className="w-full sm:w-64">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  {clientOptions.map((workExperience) => (
                    <SelectItem key={workExperience.id} value={workExperience.id}>
                      {workExperience.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <p className="body-4 text-muted-foreground">{projectCountLabel}</p>
              {selectedClientId ? (
                <Button type="button" variant="ghost" onClick={clearClientFilter} className="gap-2">
                  <XIcon className="size-4" />
                  Clear filter
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="px-6 py-10 sm:px-8">
            <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
              <FolderOpenIcon className="size-10" />
              <p className="body-2 text-foreground">
                {selectedClientId
                  ? `No projects are linked to ${selectedClient?.company || 'this client'} yet.`
                  : 'No projects added yet.'}
              </p>
              <p className="body-4 max-w-xl">
                {selectedClientId
                  ? 'Create a project from this filtered view to prefill the linked client, or clear the filter to browse everything.'
                  : 'Add your launches, case studies, and shipped work so you can edit them from a dedicated project page.'}
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filteredProjects.map((project) => (
              <ProjectSummaryCard
                key={project.id}
                project={project}
                clientLabel={
                  clientsById.get(project.work_experience_id || '') || 'Unlinked project'
                }
                onEdit={(id) =>
                  navigate(currentSearch ? `/projects/${id}?${currentSearch}` : `/projects/${id}`)
                }
              />
            ))}
          </ul>
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
