import { BriefcaseIcon, FolderIcon, PlusIcon } from 'lucide-react';
import { Link } from 'react-router';

import { SectionHeader } from '~/components/design/section-header';
import { AddButton } from '~/modules/career/components/AddButton';
import { CareerCollection } from '~/modules/career/components/career/career-list';
import { createCareerServerClient } from '~/modules/career/lib/server-client';
import { formatDateRange } from '~/modules/career/lib/utils/dateRange';

import { Route } from './+types/home';

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'Career | Hominem' },
    {
      name: 'description',
      content:
        'A private workspace for job seekers who need to reuse their best proof, tailor serious applications, and keep a long search organized.',
    },
    { property: 'og:title', content: 'Career — keep your job search from scattering' },
    {
      property: 'og:description',
      content:
        'A private workspace for job seekers who need to reuse their best proof, tailor serious applications, and keep a long search organized.',
    },
  ];
};

export async function loader({ request }: Route.LoaderArgs) {
  const career = createCareerServerClient(request);
  const [engagementsRes, projectsRes] = await Promise.all([
    career.engagements.$get({ query: {} }),
    career.projects.$get({ query: {} }),
  ]);

  const engagements = engagementsRes.ok ? (await engagementsRes.json()).engagements : [];
  const projects = projectsRes.ok ? (await projectsRes.json()).projects : [];

  return {
    engagements: engagements.slice(0, 5),
    projects: projects.slice(0, 6),
  };
}

export default function Home({ loaderData }: Pick<Route.ComponentProps, 'loaderData'>) {
  return (
    <div className="flex flex-col gap-10">
      <WorkSummary engagements={loaderData.engagements} />
      <ProjectsSummary projects={loaderData.projects} />
    </div>
  );
}

function SummarySection({
  title,
  viewAllTo,
  addTo,
  addLabel,
  children,
}: {
  title: string;
  viewAllTo: string;
  addTo: string;
  addLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionHeader
        title={title}
        actions={
          <>
            <Link
              to={viewAllTo}
              viewTransition
              className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              View all →
            </Link>
            <AddButton asChild label={addLabel}>
              <Link to={addTo}>
                <PlusIcon aria-hidden />
              </Link>
            </AddButton>
          </>
        }
      />
      <div className="mt-4">{children}</div>
    </section>
  );
}

function WorkSummary({
  engagements,
}: {
  engagements: Array<{
    id: string;
    title: string;
    company: string;
    startDate: string | null;
    endDate: string | null;
    isCurrent: boolean | null;
  }>;
}) {
  return (
    <SummarySection
      title="Work history"
      viewAllTo="/career/work"
      addTo="/career/work/new"
      addLabel="Add role"
    >
      <CareerCollection
        items={engagements}
        keyFor={(e) => e.id}
        hrefFor={(e) => `/career/work/${e.id}`}
        title={(e) => e.title}
        subtitle={(e) => e.company}
        meta={(e) => formatDateRange(e.startDate, e.isCurrent ? null : e.endDate)}
        empty={{
          icon: <BriefcaseIcon className="size-6" />,
          title: 'No positions yet',
          description: "Add your roles as you go so your story isn't a scramble later.",
          action: (
            <AddButton asChild label="Add your first role">
              <Link to="/career/work/new">
                <PlusIcon aria-hidden />
              </Link>
            </AddButton>
          ),
        }}
      />
    </SummarySection>
  );
}

function ProjectsSummary({
  projects,
}: {
  projects: Array<{
    id: string;
    title: string;
    organization: string | null;
    shortDescription: string | null;
    startDate: string | null;
    endDate: string | null;
  }>;
}) {
  return (
    <SummarySection
      title="Projects"
      viewAllTo="/career/projects"
      addTo="/career/projects/new"
      addLabel="Add project"
    >
      <CareerCollection
        items={projects}
        keyFor={(p) => p.id}
        hrefFor={(p) => `/career/projects/${p.id}`}
        title={(p) => p.title}
        subtitle={(p) => p.organization ?? p.shortDescription ?? undefined}
        meta={(p) => (p.startDate || p.endDate) && formatDateRange(p.startDate, p.endDate)}
        empty={{
          icon: <FolderIcon className="size-6" />,
          title: 'No projects yet',
          description: "Log a project or win while it's fresh, before the details fade.",
          action: (
            <AddButton asChild label="Add your first project">
              <Link to="/career/projects/new">
                <PlusIcon aria-hidden />
              </Link>
            </AddButton>
          ),
        }}
      />
    </SummarySection>
  );
}
