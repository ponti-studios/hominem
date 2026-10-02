import { CareerRepository, ProjectRepository } from '@hominem/db/career';
import { db } from '@hominem/db/core';
import { SectionIntro } from '@ponti-studios/ui/layout';
import { redirect } from 'react-router';

import { ProjectEditor } from '~/components/career/projects/ProjectEditor';
import { PROJECT_STATUSES } from '~/lib/career-options';
import { userContext } from '~/lib/middleware';
import { formChoice, formText } from '~/lib/route-utils';

import { Route } from './+types/projects.new';

export const meta: Route.MetaFunction = () => [{ title: 'Add project | career' }];

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  return { engagements: await CareerRepository.listEngagements(db, user.id, { limit: 100 }) };
}

export async function action({ context, request }: Route.ActionArgs) {
  const user = context.get(userContext)!;
  const formData = await request.formData();
  const title = formText(formData, 'title')?.trim();
  if (!title) return { error: 'Title is required' };

  const technologiesRaw = formText(formData, 'technologies') ?? '';
  const technologies = technologiesRaw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const engagementIds = formData
    .getAll('engagementIds')
    .filter((value): value is string => typeof value === 'string');

  await ProjectRepository.create(db, user.id, {
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
  });

  return redirect('/projects');
}

export default function NewProjectRoute({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <div className="max-w-2xl">
      <SectionIntro title="Add project" description="Add a side project or portfolio piece." />
      <div className="mt-6">
        <ProjectEditor engagements={loaderData.engagements} submitLabel="Add project" />
        {actionData?.error && (
          <p className="body-3 text-destructive-text mt-3">{actionData.error}</p>
        )}
      </div>
    </div>
  );
}
