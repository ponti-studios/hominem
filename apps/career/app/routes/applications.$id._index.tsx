import type {
  CareerJobApplicationRecord as ApplicationWithCompany,
  UpdateCareerJobApplicationInput,
} from '@hominem/db';
import { useOutletContext } from 'react-router';

import { ApplicationOverviewTab } from '~/components/career';
import { userContext } from '~/lib/middleware';
import { JobApplicationsService } from '~/lib/services/job-applications.service';

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

  const formData = await request.formData();
  const updates: UpdateCareerJobApplicationInput = {};

  const fields = [
    'position',
    'status',
    'location',
    'jobPosting',
    'salaryQuoted',
    'salaryAccepted',
    'companyNotes',
    'negotiationNotes',
    'recruiterName',
    'recruiterEmail',
    'recruiterLinkedin',
    'resume',
  ] as const;

  for (const field of fields) {
    const value = formData.get(field);
    if (value !== null) {
      updates[field] = value as string | undefined;
    }
  }

  await JobApplicationsService.updateApplication(id, updates);
  return { message: 'Application updated successfully' };
}

export default function ApplicationOverviewRoute() {
  const application = useOutletContext<ApplicationWithCompany>();
  return <ApplicationOverviewTab application={application} company={application.company} />;
}
