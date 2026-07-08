import { ApplicationNotesTab } from '~/components/career';
import { userContext } from '~/lib/middleware';
import { JobApplicationsService } from '~/lib/services/job-applications.service';

import { Route } from './+types/applications.$id.notes';

export async function loader({ context, params }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  const { id } = params;

  if (!id) {
    throw new Response('Application ID is required', { status: 400 });
  }

  const hasOwnership = await JobApplicationsService.verifyOwnership(id, user.id);
  if (!hasOwnership) {
    throw new Response('Application not found or access denied', { status: 403 });
  }

  const notes = await JobApplicationsService.listNotes(id);
  return { notes };
}

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
  const operation = formData.get('operation') as string;

  if (operation === 'add_note') {
    const type = formData.get('noteType') as string;
    const title = formData.get('noteTitle') as string;
    const content = formData.get('noteContent') as string;

    if (!content) {
      throw new Response('Note content is required', { status: 400 });
    }

    await JobApplicationsService.addNote(id, type, title, content);
    return { message: 'Note added successfully' };
  }

  if (operation === 'delete_note') {
    const noteId = formData.get('noteId') as string;
    await JobApplicationsService.deleteNote(noteId);
    return { message: 'Note deleted successfully' };
  }

  throw new Response('Invalid operation', { status: 400 });
}

export default function ApplicationNotesRoute({ loaderData, params }: Route.ComponentProps) {
  return <ApplicationNotesTab notes={loaderData.notes} applicationId={params.id || ''} />;
}
