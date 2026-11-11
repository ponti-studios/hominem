import { PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { AddButton } from '~/components/design';
import { CareerCollection } from '~/modules/career/components/career/career-list';
import { CollectionIndex } from '~/modules/career/components/collection-index';
import { createCareerServerClient } from '~/modules/career/lib/server-client';
import type { CareerEngagementRecord } from '~/modules/career/lib/types/records';
import { formatDateRange } from '~/modules/career/lib/utils/dateRange';

import { Route } from './+types/work';

export const meta: Route.MetaFunction = () => [
  { title: 'Positions | Hominem' },
  { name: 'description', content: 'Manage your work history and engagements.' },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { engagements: positions } = await createCareerServerClient(request)
    .engagements.$get({ query: {} })
    .then((response) => response.json());
  return { positions };
}

function filterPositions(positions: CareerEngagementRecord[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return positions;
  return positions.filter((p) => {
    const company = (p.company ?? '').toLowerCase();
    const title = (p.title ?? '').toLowerCase();
    return company.includes(query) || title.includes(query);
  });
}

export default function WorkPage({ loaderData }: Route.ComponentProps) {
  const { positions } = loaderData;
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => filterPositions(positions, search), [positions, search]);

  return (
    <CollectionIndex
      eyebrow="Career · Work"
      title="Work history"
      addTo="/career/work/new"
      addLabel="Add engagement"
      showSearch={positions.length > 0}
      search={{
        id: 'work-search',
        value: search,
        onChange: setSearch,
        placeholder: 'Search work history...',
        ariaLabel: 'Search work history',
      }}
    >
      <CareerCollection
        items={filtered}
        keyFor={(p) => p.id}
        hrefFor={(p) => `/career/work/${p.id}`}
        title={(p) => p.title}
        subtitle={(p) => p.company}
        meta={(p) =>
          `${formatDateRange(p.startDate, p.endDate)}${p.location ? ` • ${p.location}` : ''}`
        }
        empty={
          positions.length === 0
            ? {
                title: 'No engagements yet',
                description: 'Engagements will appear here once you add work history.',
                action: (
                  <AddButton asChild label="Add engagement">
                    <Link to="/career/work/new">
                      <PlusIcon aria-hidden />
                    </Link>
                  </AddButton>
                ),
              }
            : {
                title: 'No matching positions',
                description: 'Try a different search.',
              }
        }
      />
    </CollectionIndex>
  );
}
