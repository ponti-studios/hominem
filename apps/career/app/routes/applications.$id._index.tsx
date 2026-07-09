import type { JobApplicationRecord as ApplicationWithCompany } from '@hominem/db';
import { useOutletContext } from 'react-router';

import { ApplicationOverviewTab } from '~/components/career';
import { userContext } from '~/lib/middleware';
import { JobApplicationsService } from '~/lib/services/job-applications.service';
import { ApplicationFormError, parseApplicationUpdateFormData } from '~/lib/utils/applicationForm';

import { Route } from './+types/applications.$id._index';

export async function action({ context, request, params }: Route.ActionArgs) {
  const user = context.get(userContext)!;
  const { id } = params;

  if (!id) {
    throw new Response('Application ID is required', { status: 400 });
  }

  const hasOwnership = await JobApplicationsService.verifyOwnership(id, user.id);
  if (!hasOwnership) {
    throw new Response('Application not found or access denied', { status: 403 });
  }

  try {
    const formData = await request.formData();
    const { application, company } = parseApplicationUpdateFormData(formData);

    if (Object.keys(application).length > 0) {
      await JobApplicationsService.updateApplication(id, application, user.id);
    }

    if (company) {
      await JobApplicationsService.updateLinkedCompany(id, user.id, company);
    }

    return { success: true, message: 'Application updated successfully' };
  } catch (error) {
    if (error instanceof ApplicationFormError) {
      throw new Response(error.message, { status: 400 });
    }
    console.error('Error updating application:', error);
    throw new Response('Failed to update application', { status: 500 });
  }
}

export default function ApplicationOverviewRoute() {
  const application = useOutletContext<ApplicationWithCompany>();
  return <ApplicationOverviewTab application={application} company={application.company} />;
}
