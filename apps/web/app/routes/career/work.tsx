import { SectionIntro } from '@ponti-studios/ui/layout';
import { BriefcaseIcon, PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { AddButton } from '~/modules/career/components/AddButton';
import { CareerCollection } from '~/modules/career/components/career/career-list';
import { ExpandableSearch } from '~/modules/career/components/career/ExpandableSearch';
import { createCareerServerClient } from '~/modules/career/lib/server-client';
import type { CareerEngagementRecord } from '~/modules/career/lib/types/records';
import { formatDateRange } from '~/modules/career/lib/utils/dateRange';

import { Route } from './+types/work';

export const meta: Route.MetaFunction = () => [
  { title: 'Positions | Hominem' },
  { name: 'description', content: 'Manage your work history and engagements.' },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { engagements } = await createCareerServerClient(request)
    .engagements.$get({ query: {} })
    .then((response) => response.json());
  return { engagements };
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
  const { engagements: positions } = loaderData;
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => filterPositions(positions, search), [positions, search]);

  return (
    <div>
      <SectionIntro
        title="Work history"
        description="Your work history and engagements."
        actions={
          <AddButton asChild label="Add engagement">
            <Link to="/career/work/new">
              <PlusIcon aria-hidden />
            </Link>
          </AddButton>
        }
      />

      {positions.length > 0 && (
        <div className="mt-4">
          <ExpandableSearch
            id="work-search"
            value={search}
            onChange={setSearch}
            placeholder="Search work history..."
            ariaLabel="Search work history"
          />
        </div>
      )}

      <div className="mt-6">
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
                  icon: <BriefcaseIcon className="size-6" />,
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
                  variant: 'search',
                  title: 'No matching positions',
                  description: 'Try a different search.',
                }
          }
        />
      </div>
    </div>
  );
}
