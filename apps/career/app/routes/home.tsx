import { buttonVariants } from '@hominem/ui/button';
import { Route } from './+types/home';
import { Link, redirect } from 'react-router';

import { userContext } from '~/lib/middleware';
import { cn } from '~/lib/utils';

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'Craftd - keep your job search from scattering' },
    {
      name: 'description',
      content:
        'A private workspace for job seekers who need to reuse their best proof, tailor serious applications, and keep a long search organized.',
    },
    { property: 'og:title', content: 'Craftd - keep your job search from scattering' },
    {
      property: 'og:description',
      content:
        'A private workspace for job seekers who need to reuse their best proof, tailor serious applications, and keep a long search organized.',
    },
  ];
};

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (user) throw redirect('/account');
  return null;
}

const searchProblems = [
  {
    label: 'Stop starting over',
    copy: 'Every strong application asks for a slightly different version of your story.',
  },
  {
    label: 'Find your best proof',
    copy: 'Your best projects, wins, links, and resume bullets are spread across too many places.',
  },
  {
    label: 'Tailor without burning out',
    copy: 'The roles worth chasing deserve sharper context, but rewriting everything by hand does not scale.',
  },
  {
    label: 'Know what needs attention',
    copy: 'When weeks blur together, it gets hard to see what you sent, what worked, and what needs attention.',
  },
];

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      <section className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col py-6">
        <main className="flex flex-1 items-center">
          <div className="w-full">
            <div className="max-w-2xl">
              <h1 className="display-1 mt-5 max-w-2xl">Keep your job search from scattering.</h1>
              <p className="body-1 mt-6 max-w-xl text-muted-foreground">
                Craftd helps you reuse your best proof, tailor the applications that matter, and
                remember what you sent when the search stretches on.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/onboarding"
                  className={cn(buttonVariants({ size: 'lg' }), 'h-11 rounded-full px-6 text-sm')}
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
              <p className="ui-eyebrow">What gets hard</p>
              <div className="mt-5 grid gap-5 border-y border-subtle py-5">
                {searchProblems.map((problem, index) => (
                  <div key={problem.label}>
                    <p className="caption1 uppercase tracking-[0.28em] text-muted-foreground">
                      {String(index + 1).padStart(2, '0')}
                    </p>
                    <p className="heading-4 mt-3 text-foreground">{problem.label}</p>
                    <p className="body-2 mt-2 max-w-2xl text-muted-foreground">{problem.copy}</p>
                  </div>
                ))}
              </div>
            </div>

            <section className="py-7">
              <p className="ui-eyebrow">What it replaces</p>
              <p className="heading-2 mt-3 max-w-3xl text-foreground">
                No more scattered docs, messy tabs, and repeating yourself.
              </p>
              <p className="body-2 mt-5 max-w-2xl text-muted-foreground">
                Built for the parts of the search you can control: your story, your proof, your
                follow-through, and your memory. It will not make employers respond. It will help
                you stop applying from scratch.
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
