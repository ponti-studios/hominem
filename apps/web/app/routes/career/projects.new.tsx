import { SectionIntro } from '@ponti-studios/ui/layout';
import { redirect } from 'react-router';

import { ProjectEditor } from '~/modules/career/components/career/projects/ProjectEditor';
import { PROJECT_STATUSES } from '~/modules/career/lib/career-options';
import { formChoice, formText } from '~/modules/career/lib/route-utils';
import { createCareerServerClient } from '~/modules/career/lib/server-client';

import type { Route } from './+types/projects.new';

export const meta: Route.MetaFunction = () => [{ title: 'Add project | Hominem' }];

export async function loader({ request }: Route.LoaderArgs) {
  const { engagements } = await createCareerServerClient(request)
    .engagements.$get({ query: {} })
    .then((response) => response.json());
  return { engagements };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const title = formText(formData, 'title')?.trim();
  if (!title) return { error: 'Title is required' };

  const technologies = (formText(formData, 'technologies') ?? '')
    .split(',')
    .map((technology) => technology.trim())
    .filter(Boolean);
  const engagementIds = formData
    .getAll('engagementIds')
    .filter((value): value is string => typeof value === 'string');

  const response = await createCareerServerClient(request).projects.create.$post({
    json: {
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
  });
  if (!response.ok) return { error: 'Failed to create project. Please try again.' };

  return redirect('/career/projects');
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
