import { NOTES_AUTH_CONFIG } from '@hominem/auth/shared/ux-contract';
import { resolveAuthRedirect } from '@hominem/auth/shared/redirect-policy';
import type { LoaderFunctionArgs } from 'react-router';
import { data, redirect } from 'react-router';

import { getServerSession } from '~/lib/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const { user, headers } = await getServerSession(request);
  if (user) {
    return redirect('/notes', { headers });
  }

  const requestUrl = new URL(request.url);
  const rawNext = requestUrl.searchParams.get('next');
  const next = rawNext
    ? resolveAuthRedirect(rawNext, '/notes', [...NOTES_AUTH_CONFIG.allowedDestinations]).safeRedirect
    : '/notes';

  return data({ next }, { headers });
}

export default function HomePage({ loaderData }: { loaderData: { next: string } }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center gap-6 px-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-text-tertiary">Hominem</p>
        <h1 className="mt-3 text-4xl font-semibold text-foreground">Notes, files, voice, chat.</h1>
        <p className="mt-4 max-w-2xl text-base text-text-secondary">
          Capture notes, attach files, dictate with speech-to-text, and chat with your notes as
          explicit context.
        </p>
      </div>
      <div className="flex gap-3">
        <a
          href={`/auth?next=${encodeURIComponent(loaderData.next)}`}
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          Sign in
        </a>
      </div>
    </div>
  );
}
