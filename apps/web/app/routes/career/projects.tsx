import { SectionIntro } from '@ponti-studios/ui/layout';
import { FolderIcon, FolderKanbanIcon, PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { AddButton } from '~/modules/career/components/AddButton';
import { CareerCollection } from '~/modules/career/components/career/career-list';
import { ExpandableSearch } from '~/modules/career/components/career/ExpandableSearch';
import { createCareerServerClient } from '~/modules/career/lib/server-client';
import type { CareerProjectRecord } from '~/modules/career/lib/types/records';
import { formatDateRange } from '~/modules/career/lib/utils/dateRange';

import { Route } from './+types/projects';

export const meta: Route.MetaFunction = () => [
  { title: 'Projects | Hominem' },
  { name: 'description', content: 'Side projects and portfolio work.' },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { projects } = await createCareerServerClient(request)
    .projects.$get({ query: {} })
    .then((response) => response.json());
  return { projects };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  if (formData.get('intent') === 'delete') {
    const id = formData.get('id');
    if (typeof id === 'string') {
      await createCareerServerClient(request).projects.delete.$post({ json: { id } });
    }
  }
  return { ok: true };
}

function filterProjects(projects: CareerProjectRecord[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return projects;
  return projects.filter((p) => p.title.toLowerCase().includes(query));
}

export default function ProjectsRoute({ loaderData }: Route.ComponentProps) {
  const { projects } = loaderData;
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => filterProjects(projects, search), [projects, search]);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <SectionIntro title="Projects" description="Side projects and portfolio work." />
        <AddButton asChild label="Add project">
          <Link to="/career/projects/new">
            <PlusIcon aria-hidden />
          </Link>
        </AddButton>
      </div>

      {projects.length > 0 && (
        <div className="mt-4">
          <ExpandableSearch
            id="projects-search"
            value={search}
            onChange={setSearch}
            placeholder="Search projects..."
            ariaLabel="Search projects"
          />
        </div>
      )}

      <div className="mt-6">
        <CareerCollection
          items={filtered}
          keyFor={(p) => p.id}
          hrefFor={(p) => `/career/projects/${p.id}`}
          leading={() => (
            <span className="flex size-10 items-center justify-center rounded-xl bg-warning-subtle text-warning sm:size-11">
              <FolderKanbanIcon className="size-5" aria-hidden />
            </span>
          )}
          title={(p) => p.title}
          subtitle={(p) => p.organization ?? p.shortDescription ?? undefined}
          meta={(p) => (p.startDate || p.endDate) && formatDateRange(p.startDate, p.endDate)}
          empty={
            projects.length === 0
              ? {
                  icon: <FolderIcon className="size-6" />,
                  title: 'No projects yet',
                  description: 'Add a project to showcase your work.',
                }
              : {
                  variant: 'search',
                  title: 'No matching projects',
                  description: 'Try a different search.',
                }
          }
        />
      </div>
    </div>
  );
}
