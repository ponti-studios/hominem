import { buttonVariants } from '@hominem/ui/button';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { Link } from 'react-router';

import { cn } from '~/lib/utils';

export const meta: MetaFunction = () => {
  return [
    { title: 'Craftd - your career, art directed' },
    {
      name: 'description',
      content:
        'A minimalist portfolio and application tracker for people who want their career story to feel curated, current, and easy to share.',
    },
    { property: 'og:title', content: 'Craftd - your career, art directed' },
    {
      property: 'og:description',
      content:
        'A minimalist portfolio and application tracker for people who want their career story to feel curated, current, and easy to share.',
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { getServerSession, redirectIfAuthenticated } = await import('../lib/auth.server');
  const { user, headers } = await getServerSession(request);
  redirectIfAuthenticated(user, '/account', headers);
  return null;
}

const studioNotes = [
  {
    label: 'Scatterd files',
    copy: 'A single polished link instead of a pile of files.',
  },
  {
    label: 'Missed follow-ups',
    copy: 'Track every role without losing the thread.',
  },
  {
    label: 'No clear signal',
    copy: 'See where momentum is stalling before weeks slip by.',
  },
  {
    label: 'Messy materials',
    copy: 'Your resume, projects, and proof of work end up in too many places.',
  },
  {
    label: 'Role chaos',
    copy: 'Every stage, follow-up, and deadline turns into one more thing to remember.',
  },
  {
    label: 'Stalled progress',
    copy: 'Without a clear read, it is hard to tell what is moving and what is stuck.',
  },
];

export default function Home() {
  return (
    <div className="relative overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-elevated/35 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
        aria-hidden
      />

      <section className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <main className="flex flex-1 items-center py-16 lg:py-24">
          <div className="w-full">
            <div className="max-w-2xl">
              <p className="ui-eyebrow">Private access</p>
              <h1 className="display-1 mt-5 max-w-2xl">Keep your career from getting scattered.</h1>
              <p className="body-1 mt-6 max-w-xl text-muted-foreground">
                When your portfolio, resume, and applications live in different places, staying
                current starts to feel like a second job.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/onboarding"
                  className={cn(
                    buttonVariants({ variant: 'primary', size: 'lg' }),
                    'h-11 rounded-full px-6 text-sm',
                  )}
                >
                  Get organized
                </Link>
                <Link
                  to="/demo"
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'lg' }),
                    'h-11 rounded-full px-5 text-sm',
                  )}
                >
                  See the difference
                </Link>
              </div>
            </div>

            <div className="mt-14 border-t border-subtle pt-6">
              <p className="ui-eyebrow">
                Problems. Meet <i>solutions</i>.
              </p>
              <div className="mt-5 grid gap-0 border-y border-subtle">
                {studioNotes.map((note, index) => (
                  <div
                    key={note.label}
                    className={cn(
                      'py-5',
                      index !== studioNotes.length - 1 && 'border-b border-subtle',
                    )}
                  >
                    <p className="heading-4 text-foreground">{note.label}</p>
                    <p className="body-2 mt-2 max-w-2xl text-muted-foreground">{note.copy}</p>
                  </div>
                ))}
              </div>
              <p className="subheading-1 mt-8 max-w-2xl text-foreground">
                Built for the moments when your career materials feel scattered, stale, and hard to
                keep up with.
              </p>
              <p className="body-2 mt-3 text-muted-foreground">Less scrambling, more clarity.</p>
            </div>

            <section className="mt-14 border-t border-subtle py-7">
              <p className="ui-eyebrow">What it replaces</p>
              <p className="heading-2 mt-3 max-w-3xl text-foreground">
                scattered docs, messy tabs, and a portfolio that never felt finished.
              </p>
            </section>

            <footer className="flex items-center justify-between border-t border-subtle py-5 footnote text-muted-foreground">
              <span>Craftd</span>
              <span>Less scrambling. More control.</span>
            </footer>
          </div>
        </main>
      </section>
    </div>
  );
}
