import { type LoaderFunctionArgs, redirect } from 'react-router';

import { requireAuth } from '~/lib/guards';

export async function noteIdLoader({ request, params }: LoaderFunctionArgs) {
  await requireAuth(request);
  const { noteId } = params;

  if (!noteId) {
    return redirect('/notes');
  }

  return { noteId };
}
