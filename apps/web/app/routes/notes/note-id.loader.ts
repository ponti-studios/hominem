import { type LoaderFunctionArgs, data, redirect } from 'react-router';

import { requireAuth } from '~/lib/guards';
import { serverEnv } from '~/lib/env.server';

export async function noteIdLoader({ request, params }: LoaderFunctionArgs) {
  await requireAuth(request);
  const { noteId } = params;

  if (!noteId) {
    return redirect('/notes');
  }

  const cookie = request.headers.get('cookie');
  const headers = cookie ? { cookie } : undefined;
  const response = await fetch(
    new URL(`/api/notes/${noteId}`, serverEnv.VITE_PUBLIC_API_URL).toString(),
    { headers },
  );
  const note = response.ok ? await response.json().catch(() => null) : null;

  return data({ noteId, note });
}
