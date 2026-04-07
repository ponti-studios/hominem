import { type LoaderFunctionArgs, redirect } from 'react-router';

import { requireAuth } from '~/lib/guards';

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAuth(request);
  const { noteId } = params;

  if (!noteId) {
    return redirect('/notes');
  }

  return redirect(`/chat?noteId=${noteId}`);
}
