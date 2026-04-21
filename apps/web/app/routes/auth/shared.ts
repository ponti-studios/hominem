import { NOTES_AUTH_CONFIG } from '@hakumi/auth/shared/ux-contract';

export function getNextRedirect(search: string) {
  return new URLSearchParams(search).get('next') ?? NOTES_AUTH_CONFIG.defaultPostAuthDestination;
}
