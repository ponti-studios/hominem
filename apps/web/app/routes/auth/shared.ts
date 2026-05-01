import { NOTES_AUTH_CONFIG } from '~/config/auth';

export function getNextRedirect(search: string) {
  return new URLSearchParams(search).get('next') ?? NOTES_AUTH_CONFIG.defaultPostAuthDestination;
}
