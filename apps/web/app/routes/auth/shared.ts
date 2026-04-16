import { NOTES_AUTH_CONFIG } from '@hominem/auth/shared/ux-contract';

export function getNextRedirect(search: string) {
  return new URLSearchParams(search).get('next') ?? NOTES_AUTH_CONFIG.defaultPostAuthDestination;
}
