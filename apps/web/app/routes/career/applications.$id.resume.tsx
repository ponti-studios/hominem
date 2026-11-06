import type { ActionFunctionArgs } from 'react-router';
import { useOutletContext } from 'react-router';

import { ApplicationResumeTab } from '~/modules/career/components/career';
import { formText } from '~/modules/career/lib/route-utils';
import { createCareerServerClient } from '~/modules/career/lib/server-client';
import type { CareerApplicationRecord } from '~/modules/career/lib/types/records';

export async function action({ request, params }: ActionFunctionArgs) {
  const { id } = params;
  if (!id) throw new Response('Application ID is required', { status: 400 });

  const resume = formText(await request.formData(), 'resume') ?? '';
  if (!resume) throw new Response('Resume content is required', { status: 400 });

  const response = await createCareerServerClient(request).applications.update.$post({
    json: { id, data: { resumeUrl: resume } },
  });
  if (response.status === 404) {
    throw new Response('Application not found or access denied', { status: 403 });
  }
  if (!response.ok) throw new Response('Failed to save resume', { status: 500 });

  return { message: 'Resume saved successfully' };
}

export default function ApplicationResumeRoute({ params }: { params: { id?: string } }) {
  const application = useOutletContext<CareerApplicationRecord>();
  return <ApplicationResumeTab application={application} applicationId={params.id || ''} />;
}
