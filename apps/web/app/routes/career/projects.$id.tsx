import { Button } from '@ponti-studios/ui/primitives';
import { ArrowLeftIcon, CodeIcon, ExternalLinkIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { Form, Link, redirect } from 'react-router';

import { CareerList, CareerListRow } from '~/modules/career/components/career/career-list';
import { ProjectEditor } from '~/modules/career/components/career/projects/ProjectEditor';
import { StatusBadge } from '~/modules/career/components/status-badge';
import { PROJECT_STATUSES } from '~/modules/career/lib/career-options';
import { formChoice, formText } from '~/modules/career/lib/route-utils';
import { createCareerServerClient } from '~/modules/career/lib/server-client';
import { formatDateRange } from '~/modules/career/lib/utils/dateRange';
import { formatProjectStatus, getProjectStatusTone } from '~/modules/career/lib/utils/projectUtils';

import { Route } from './+types/projects.$id';

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: loaderData ? `${loaderData.project.title} | Hominem` : 'Project | Hominem' },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  const career = createCareerServerClient(request);
  const [projectResponse, engagementsResponse] = await Promise.all([
    career.projects[':id'].$get({ param: { id: params.id } }),
    career.engagements.$get({ query: {} }),
  ]);
  if (projectResponse.status === 404) throw new Response('Project not found', { status: 404 });
  if (!projectResponse.ok || !engagementsResponse.ok) {
    throw new Response('Failed to load project', { status: 500 });
  }
  return {
    project: await projectResponse.json(),
    engagements: (await engagementsResponse.json()).engagements,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const career = createCareerServerClient(request);

  if (intent === 'delete') {
    const response = await career.projects.delete.$post({ json: { id: params.id } });
    if (!response.ok) throw new Response('Failed to delete project', { status: 500 });
    return redirect('/career/projects');
  }

  const title = formText(formData, 'title')?.trim();
  if (!title) return { error: 'Title is required' };

  const technologies = (formText(formData, 'technologies') ?? '')
    .split(',')
    .map((technology) => technology.trim())
    .filter(Boolean);
  const engagementIds = formData
    .getAll('engagementIds')
    .filter((value): value is string => typeof value === 'string');

  const response = await career.projects.update.$post({
    json: {
      id: params.id,
      data: {
        title,
        organization: formText(formData, 'organization') || null,
        description: formText(formData, 'description') || null,
        shortDescription: formText(formData, 'shortDescription') || null,
        liveUrl: formText(formData, 'liveUrl') || null,
        githubUrl: formText(formData, 'githubUrl') || null,
        startDate: formText(formData, 'startDate') || null,
        endDate: formText(formData, 'endDate') || null,
        status: formChoice(formData, 'status', PROJECT_STATUSES, 'BACKLOG'),
        technologies,
        engagementIds,
      },
    },
  });
  if (!response.ok) return { error: 'Failed to update project. Please try again.' };

  return { ok: true };
}

const cardClass = 'rounded-xl border border-border bg-card p-6';

export default function ProjectDetailRoute({ loaderData }: Route.ComponentProps) {
  const { project, engagements } = loaderData;
  const [isEditing, setIsEditing] = useState(false);
  const technologies = Array.isArray(project.technologies) ? project.technologies : [];

  if (isEditing) {
    return (
      <div>
        <Link
          to="/career/projects"
          className="footnote mb-4 inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Projects
        </Link>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="heading-2">Edit project</h1>
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        </div>
        <div className={cardClass}>
          <ProjectEditor
            project={project}
            engagements={engagements}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/career/projects"
        className="footnote mb-4 inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Projects
      </Link>

      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="heading-1">{project.title}</h1>
            {project.organization && (
              <p className="heading-4 mt-1 text-muted-foreground">{project.organization}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Button>
            <Form
              method="post"
              onSubmit={(e) => {
                if (!confirm(`Delete "${project.title}"?`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="intent" value="delete" />
              <Button type="submit" variant="outline" size="sm">
                <Trash2Icon className="mr-2 size-4" />
                Delete
              </Button>
            </Form>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {project.status && (
            <StatusBadge
              tone={getProjectStatusTone(project.status)}
              label={formatProjectStatus(project.status)}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {(project.startDate || project.endDate || project.shortDescription) && (
          <section className={cardClass}>
            <h2 className="ui-eyebrow mb-4 text-muted-foreground">Details</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <DetailField label="Summary" value={project.shortDescription} />
              {(project.startDate || project.endDate) && (
                <DetailField
                  label="Timeline"
                  value={formatDateRange(project.startDate, project.endDate)}
                  mono
                />
              )}
            </div>
          </section>
        )}

        {project.description && (
          <section className={cardClass}>
            <h2 className="ui-eyebrow mb-3 text-muted-foreground">Description</h2>
            <p className="body-2 whitespace-pre-wrap text-foreground">{project.description}</p>
          </section>
        )}

        {technologies.length > 0 && (
          <section className={cardClass}>
            <h2 className="ui-eyebrow mb-3 text-muted-foreground">Technologies</h2>
            <div className="flex flex-wrap gap-2">
              {technologies.map((tech) => (
                <StatusBadge key={String(tech)} tone="neutral" label={String(tech)} />
              ))}
            </div>
          </section>
        )}

        {project.engagements.length > 0 && (
          <section className={cardClass}>
            <h2 className="ui-eyebrow mb-3 text-muted-foreground">Related work</h2>
            <CareerList>
              {project.engagements.map((engagement) => (
                <CareerListRow
                  key={engagement.id}
                  to={`/career/work/${engagement.id}`}
                  title={engagement.title}
                  subtitle={engagement.company}
                />
              ))}
            </CareerList>
          </section>
        )}

        {(project.liveUrl || project.githubUrl) && (
          <section className={cardClass}>
            <h2 className="ui-eyebrow mb-3 text-muted-foreground">Links</h2>
            <div className="flex flex-col gap-2">
              {project.liveUrl && (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="body-3 inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <ExternalLinkIcon className="size-3.5" />
                  {project.liveUrl}
                </a>
              )}
              {project.githubUrl && (
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="body-3 inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <CodeIcon className="size-3.5" />
                  {project.githubUrl}
                </a>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <p className="footnote text-muted-foreground">{label}</p>
      <p className={mono ? 'body-3 font-mono text-foreground' : 'body-3 text-foreground'}>
        {value}
      </p>
    </div>
  );
}
