import { buildAuthCallbackErrorRedirect } from '@hakumi/auth/shared/error-contract';
import { resolveAuthRedirect } from '@hakumi/auth/shared/redirect-policy';
import { NOTES_AUTH_CONFIG } from '@hakumi/auth/shared/ux-contract';
import { redirect } from 'react-router';
import type { ActionFunctionArgs } from 'react-router';

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
