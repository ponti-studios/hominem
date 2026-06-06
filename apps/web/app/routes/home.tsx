import { BRAND } from '@hominem/env/brand';
import { buttonVariants } from '@hominem/ui/button';
import { cn } from '@hominem/ui/lib/utils';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { Link, redirect } from 'react-router';

import { userContext } from '~/lib/middleware';

export const meta: MetaFunction = () => [
  { title: `${BRAND.appName} — ${BRAND.tagline}` },
  { name: 'description', content: BRAND.tagline },
  { property: 'og:title', content: `${BRAND.appName} — ${BRAND.tagline}` },
  { property: 'og:description', content: BRAND.tagline },
];

export async function loader({ context }: LoaderFunctionArgs) {
  const user = context.get(userContext);
  if (user) {
    return redirect('/inbox');
  }
  return null;
}

const frictions = [
  {
    label: 'Stop losing thoughts',
    copy: 'A voice memo, a stray idea, a link you meant to read — they disappear before you do anything with them.',
  },
  {
    label: 'Keep context with your notes',
    copy: 'Files, links, and related notes live separately. When you need them together, you are left searching.',
  },
  {
    label: 'Actually use what you captured',
    copy: 'Most notes are written once and never read. Chat lets you pull answers and connections out of your own archive.',
  },
  {
    label: 'One inbox for everything',
    copy: 'Notes, chats, and voice recordings all land in one place in reverse-chronological order — nothing falls through.',
  },
];

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      <section className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col py-6">
        <main className="flex flex-1 items-center">
          <div className="w-full">
            <div className="max-w-2xl">
              <h1 className="display-1 mt-5 max-w-2xl">
                Capture, connect, and chat with your thoughts.
              </h1>
              <p className="body-1 mt-6 max-w-xl text-muted-foreground">
                {BRAND.appName} brings notes, voice, files, and AI chat into one workspace — so
                nothing you capture stays isolated.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/auth"
                  className={cn(buttonVariants({ size: 'lg' }), 'h-11 rounded-full px-6 text-sm')}
                >
                  Start capturing
                </Link>
              </div>
            </div>

            <div className="mt-14 border-t border-subtle pt-6">
              <p className="ui-eyebrow">What gets lost without it</p>
              <div className="mt-5 grid gap-5 border-y border-subtle py-5">
                {frictions.map((item, index) => (
                  <div key={item.label}>
                    <p className="caption1 uppercase tracking-[0.28em] text-muted-foreground">
                      {String(index + 1).padStart(2, '0')}
                    </p>
                    <p className="heading-4 mt-3 text-foreground">{item.label}</p>
                    <p className="body-2 mt-2 max-w-2xl text-muted-foreground">{item.copy}</p>
                  </div>
                ))}
              </div>
            </div>

            <section className="py-7">
              <p className="ui-eyebrow">What it gives you</p>
              <p className="heading-2 mt-3 max-w-3xl text-foreground">
                No more scattered apps and thoughts you can not find.
              </p>
              <p className="body-2 mt-5 max-w-2xl text-muted-foreground">
                Built around the way capture actually works: fast when you need to get something
                down, searchable when you need it back, and conversational when you need to think
                with it.
              </p>
            </section>

            <footer className="flex items-center justify-between border-t border-subtle py-5 footnote text-muted-foreground">
              <span>{BRAND.appName}</span>
              <span>Capture more. Lose less.</span>
            </footer>
          </div>
        </main>
      </section>
    </div>
  );
}
