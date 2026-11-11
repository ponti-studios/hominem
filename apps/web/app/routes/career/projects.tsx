import { FolderKanbanIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CareerCollection } from '~/modules/career/components/career/career-list';
import { CollectionIndex } from '~/modules/career/components/collection-index';
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
    <CollectionIndex
      eyebrow="Career · Projects"
      title="Projects"
      description="Side projects and portfolio work."
      addTo="/career/projects/new"
      addLabel="Add project"
      showSearch={projects.length > 0}
      search={{
        id: 'projects-search',
        value: search,
        onChange: setSearch,
        placeholder: 'Search projects...',
        ariaLabel: 'Search projects',
      }}
    >
      <CareerCollection
        items={filtered}
        keyFor={(p) => p.id}
        hrefFor={(p) => `/career/projects/${p.id}`}
        leading={() => (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-foreground">
            <FolderKanbanIcon className="size-4" aria-hidden />
          </span>
        )}
        title={(p) => p.title}
        subtitle={(p) => p.organization ?? p.shortDescription ?? undefined}
        meta={(p) => (p.startDate || p.endDate) && formatDateRange(p.startDate, p.endDate)}
        empty={
          projects.length === 0
            ? {
                title: 'No projects yet',
                description: 'Add a project to showcase your work.',
              }
            : {
                title: 'No matching projects',
                description: 'Try a different search.',
              }
        }
      />
    </CollectionIndex>
  );
}
