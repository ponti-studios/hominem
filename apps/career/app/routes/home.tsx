import { buttonVariants } from '@hominem/ui/button';
import {
  ArrowRightIcon,
  BarChart3Icon,
  BriefcaseIcon,
  GlobeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ZapIcon,
} from 'lucide-react';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { Link } from 'react-router';

import { cn } from '~/lib/utils';

export const meta: MetaFunction = () => {
  return [
    { title: 'Craftd - Create Your Dream Portfolio' },
    {
      name: 'description',
      content:
        'Create stunning portfolios in minutes, not hours. Our AI-powered builder makes professional portfolio creation simple and beautiful.',
    },
    { property: 'og:title', content: 'Craftd - Create Your Dream Portfolio' },
    {
      property: 'og:description',
      content:
        'Create stunning portfolios in minutes, not hours. Our AI-powered builder makes professional portfolio creation simple and beautiful.',
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { getServerSession, redirectIfAuthenticated } = await import('../lib/auth.server');
  const { user, headers } = await getServerSession(request);
  redirectIfAuthenticated(user, '/account', headers);
  return null;
}

const features = [
  {
    icon: ZapIcon,
    title: 'Fast setup',
    description:
      'Turn resume content into a structured portfolio without rebuilding every section by hand.',
  },
  {
    icon: SparklesIcon,
    title: 'Polished writing',
    description: 'Shape your experience, skills, and proof points into copy that reads clearly.',
  },
  {
    icon: BriefcaseIcon,
    title: 'Career context',
    description:
      'Connect applications, experience, and projects so your story stays current.',
  },
  {
    icon: GlobeIcon,
    title: 'Public sharing',
    description:
      'Publish a focused portfolio page and share it during job searches or networking.',
  },
  {
    icon: BarChart3Icon,
    title: 'Progress tracking',
    description:
      'Review applications, source performance, compensation growth, and career momentum.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Private by default',
    description:
      'Keep control over what is public while managing your career data in one place.',
  },
];

const companies = ['Google', 'Meta', 'Stripe', 'Airbnb', 'Notion', 'Linear'];

export default function Home() {
  return (
    <div className="w-full">
      {/* Hero */}
      <section className="relative flex min-h-[85vh] flex-col items-center justify-center py-20 text-center">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(142, 141, 255, 0.25), transparent)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(245,246,248,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(245,246,248,0.04) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="mx-auto max-w-4xl space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs text-accent">
            <SparklesIcon className="size-3" />
            AI-powered career platform
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Build and deploy{' '}
            <span
              style={{
                backgroundImage: 'linear-gradient(135deg, #8E8DFF 0%, #38BDF8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              your career
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            Create a focused professional portfolio, track applications, and keep your career story
            organized from first draft to final offer.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/onboarding"
              className={cn(buttonVariants({ variant: 'primary' }), 'h-11 gap-2 px-6 text-sm')}
            >
              Start Building
              <ArrowRightIcon className="size-4" />
            </Link>
            <Link
              to="/demo"
              className={cn(buttonVariants({ variant: 'outline' }), 'h-11 px-6 text-sm')}
            >
              View Demo
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            No credit card required · Free to get started
          </p>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-y border-border py-10">
        <p className="mb-6 text-center text-xs text-muted-foreground">
          Trusted by job seekers landing roles at
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8">
          {companies.map((company) => (
            <span key={company} className="text-sm font-semibold text-muted-foreground/50">
              {company}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="mb-12 space-y-3 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything stays connected
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Portfolio editing, career history, and application tracking in one coherent workflow.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={cn(
                  'group p-6 transition-colors hover:bg-card',
                  'border-dashed border-border',
                  // bottom border on first row only
                  i < 3 ? 'border-b' : '',
                  // right border except last in each row
                  i % 3 !== 2 ? 'border-r' : '',
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="size-4 shrink-0 text-accent" />
                  <p className="font-medium text-foreground">{feature.title}</p>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div
          className="relative overflow-hidden rounded-2xl border border-border p-12 text-center"
          style={{
            background:
              'radial-gradient(ellipse 80% 80% at 50% 120%, rgba(142, 141, 255, 0.18), rgba(24,25,27,1))',
          }}
        >
          <div className="relative z-10 mx-auto max-w-xl space-y-6">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Deploy your career story
            </h2>
            <p className="text-muted-foreground">
              Start with onboarding, publish when you're ready, and keep refining as your search
              evolves.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                to="/onboarding"
                className={cn(buttonVariants({ variant: 'primary' }), 'h-11 gap-2 px-6 text-sm')}
              >
                Create Your Portfolio
                <ArrowRightIcon className="size-4" />
              </Link>
              <Link
                to="/demo"
                className={cn(buttonVariants({ variant: 'outline' }), 'h-11 px-6 text-sm')}
              >
                Explore Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border pb-8 pt-12">
        <div className="grid gap-8 sm:grid-cols-4">
          <div className="space-y-2 sm:col-span-1">
            <p className="font-semibold text-foreground">Craftd</p>
            <p className="text-sm text-muted-foreground">
              Build your career story, one step at a time.
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Product
            </p>
            <nav className="flex flex-col gap-2 text-sm">
              <Link
                to="/demo"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Demo
              </Link>
              <Link
                to="/onboarding"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Get Started
              </Link>
            </nav>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Account
            </p>
            <nav className="flex flex-col gap-2 text-sm">
              <Link
                to="/login"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Log In
              </Link>
              <Link
                to="/onboarding"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign Up
              </Link>
            </nav>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Resources
            </p>
            <nav className="flex flex-col gap-2 text-sm">
              <Link
                to="/demo"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Example Portfolio
              </Link>
            </nav>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>© 2026 Craftd. All rights reserved.</span>
          <span>Built for job seekers</span>
        </div>
      </footer>
    </div>
  );
}
