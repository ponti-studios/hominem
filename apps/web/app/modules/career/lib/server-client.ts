import { createApiClient } from '@hominem/rpc';

import { serverEnv } from '~/lib/env.server';

// Server-side career client for route loaders/actions. Forwards the caller's
// session cookie; the career sub-app never touches the database directly.
export function createCareerServerClient(request: Request) {
  return createApiClient({
    baseUrl: serverEnv.HOMINEM_INTERNAL_API_URL,
    request,
    throwOnError: false,
  }).api.career;
}

/** Forward a multipart image upload to the API with the caller's session cookie. */
export async function uploadCareerProfileImage(request: Request, image: File) {
  const form = new FormData();
  form.set('image', image);
  return fetch(new URL('/api/career/profile/image', serverEnv.HOMINEM_INTERNAL_API_URL), {
    method: 'POST',
    headers: { cookie: request.headers.get('cookie') ?? '' },
    body: form,
  });
}

/** Forward a multipart document upload to the API with the caller's session cookie. */
export async function uploadCareerDocument(request: Request, file: File) {
  const form = new FormData();
  form.set('file', file);
  return fetch(new URL('/api/career/documents', serverEnv.HOMINEM_INTERNAL_API_URL), {
    method: 'POST',
    headers: { cookie: request.headers.get('cookie') ?? '' },
    body: form,
  });
}
