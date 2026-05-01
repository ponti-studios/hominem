import { buildAuthCallbackErrorRedirect } from '@hominem/auth/shared/error-contract';
import { resolveAuthRedirect } from '@hominem/auth/shared/redirect-policy';
import { redirect } from 'react-router';
import type { ActionFunctionArgs } from 'react-router';

import { NOTES_AUTH_CONFIG } from '~/config/auth';

export async function action({ request }: ActionFunctionArgs) {
  let payload: { next?: string };
  try {
    payload = (await request.json()) as { next?: string };
  } catch {
    return redirect(
      buildAuthCallbackErrorRedirect({
        next: null,
        fallback: NOTES_AUTH_CONFIG.defaultPostAuthDestination,
        allowedPrefixes: [...NOTES_AUTH_CONFIG.allowedDestinations],
        description: 'Passkey sign-in failed. Please try again.',
      }),
    );
  }

  return redirect(
    resolveAuthRedirect(payload.next, NOTES_AUTH_CONFIG.defaultPostAuthDestination, [
      ...NOTES_AUTH_CONFIG.allowedDestinations,
    ]).safeRedirect,
  );
}
