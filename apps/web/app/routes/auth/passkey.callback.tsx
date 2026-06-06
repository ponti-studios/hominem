import { redirect } from 'react-router';
import type { ActionFunctionArgs } from 'react-router';

import { userContext } from '~/lib/middleware';

import type { Route } from './+types/passkey.callback';

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return redirect('/auth');
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return redirect('/auth?error=Invalid+request');
  }

  if (!payload || typeof payload !== 'object') {
    return redirect('/auth?error=Invalid+request');
  }

  const user = context.get(userContext);
  if (!user) {
    return redirect('/auth?error=Passkey+sign-in+failed.+Please+try+again.');
  }

  return redirect('/inbox');
}

export default function PasskeyCallback() {
  return null;
}
