import { AUTH_CONFIG } from './config';

export function getNextRedirect(search: string) {
  return new URLSearchParams(search).get('next') ?? AUTH_CONFIG.defaultRedirect;
}
