import type {
  CareerInterviewEntry as InterviewEntry,
  JobApplicationRecord as ApplicationWithCompany,
} from '@hominem/db';
import { useOutletContext } from 'react-router';

import { ApplicationTimelineTab } from '~/components/career';
import { userContext } from '~/lib/middleware';
import { JobApplicationsService } from '~/lib/services/job-applications.service';

import { Route } from './+types/applications.$id.timeline';

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
  const interviewType = formData.get('interviewType') as InterviewEntry['type'];
  const interviewDate = formData.get('interviewDate') as string;
  const interviewer = formData.get('interviewer') as string;
  const notes = formData.get('interviewNotes') as string;

  if (!interviewDate) {
    throw new Response('Interview date is required', { status: 400 });
  }

  const newInterview: InterviewEntry = {
    type: interviewType,
    date: interviewDate,
    interviewer: interviewer || undefined,
    notes: notes || undefined,
  };

  await JobApplicationsService.addInterview(id, newInterview);
  return { message: 'Interview added successfully' };
}

export default function ApplicationTimelineRoute({ params }: Route.ComponentProps) {
  const application = useOutletContext<ApplicationWithCompany>();
  return <ApplicationTimelineTab application={application} applicationId={params.id || ''} />;
}
