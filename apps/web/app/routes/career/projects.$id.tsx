import { CodeIcon, ExternalLinkIcon, PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { redirect } from 'react-router';

import {
  BackLink,
  DeleteButton,
  DetailField,
  DetailHero,
  DetailSection,
} from '~/components/design';
import { List, RowLink } from '~/components/design/lists';
import { Button } from '~/components/ui/button';
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

export default function ProjectDetailRoute({ loaderData }: Route.ComponentProps) {
  const { project, engagements } = loaderData;
  const [isEditing, setIsEditing] = useState(false);
  const technologies = Array.isArray(project.technologies) ? project.technologies : [];

  if (isEditing) {
    return (
      <div>
        <DetailHero
          eyebrow="Projects"
          back={<BackLink to="/career/projects" label="Projects" variant="icon" />}
          title="Edit project"
          actions={
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          }
        />
        <DetailSection title="Project">
          <ProjectEditor
            project={project}
            engagements={engagements}
            onCancel={() => setIsEditing(false)}
          />
        </DetailSection>
      </div>
    );
  }

  return (
    <div>
      <DetailHero
        eyebrow="Projects"
        back={<BackLink to="/career/projects" label="Projects" variant="icon" />}
        title={project.title}
        subtitle={project.organization ?? undefined}
        badges={
          project.status ? (
            <StatusBadge
              tone={getProjectStatusTone(project.status)}
              label={formatProjectStatus(project.status)}
            />
          ) : undefined
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Button>
            <DeleteButton itemName={project.title} />
          </>
        }
      />

      <div className="grid gap-4">
        {(project.startDate || project.endDate || project.shortDescription) && (
          <DetailSection title="Details">
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
          </DetailSection>
        )}

        {project.description && (
          <DetailSection title="Description">
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-foreground">
              {project.description}
            </p>
          </DetailSection>
        )}

        {technologies.length > 0 && (
          <DetailSection title="Technologies">
            <div className="flex flex-wrap gap-2">
              {technologies.map((tech) => (
                <StatusBadge key={String(tech)} tone="neutral" label={String(tech)} />
              ))}
            </div>
          </DetailSection>
        )}

        {project.engagements.length > 0 && (
          <DetailSection title="Related work">
            <List.Items ariaLabel="Related work">
              {project.engagements.map((engagement) => (
                <li key={engagement.id}>
                  <RowLink
                    to={`/career/work/${engagement.id}`}
                    title={engagement.title}
                    subtitle={engagement.company}
                  />
                </li>
              ))}
            </List.Items>
          </DetailSection>
        )}

        {(project.liveUrl || project.githubUrl) && (
          <DetailSection title="Links">
            <div className="flex flex-col gap-2">
              {project.liveUrl && (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-foreground hover:underline"
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
                  className="inline-flex items-center gap-1.5 text-sm text-foreground hover:underline"
                >
                  <CodeIcon className="size-3.5" />
                  {project.githubUrl}
                </a>
              )}
            </div>
          </DetailSection>
        )}
      </div>
    </div>
  );
}
