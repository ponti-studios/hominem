import { Badge } from '@hominem/ui/badge';
import { buttonVariants } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import {
  BarChart3Icon,
  BriefcaseIcon,
  GlobeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ZapIcon,
} from 'lucide-react';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { Link } from 'react-router';

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
    description: 'Connect applications, experience, and projects so your story stays current.',
  },
  {
    icon: GlobeIcon,
    title: 'Public sharing',
    description: 'Publish a focused portfolio page and share it during job searches or networking.',
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
    description: 'Keep control over what is public while managing your career data in one place.',
  },
];

const stats = [
  { label: 'Portfolio sections', value: '7' },
  { label: 'Career views', value: '4' },
  { label: 'Application filters', value: '3' },
  { label: 'Setup flow', value: '1' },
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-16">
      <section className="grid min-h-[58vh] items-center gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-8">
          <Badge variant="outline" className="border-accent/30 bg-accent/10 text-foreground">
            Portfolio builder for active job searches
          </Badge>
          <div className="space-y-5">
            <h1 className="display-2 max-w-3xl text-foreground">Craftd</h1>
            <p className="body-1 max-w-2xl text-muted-foreground">
              Create a focused professional portfolio, track applications, and keep your career
              story organized from first draft to final offer.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/onboarding" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
              Start Building
            </Link>
            <Link to="/demo" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              View Demo
            </Link>
          </div>
          <p className="body-4 text-muted-foreground">No credit card required.</p>
        </div>

        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="body-4 text-muted-foreground">Today</p>
                <h2 className="heading-3 text-foreground">Career workspace</h2>
              </div>
              <SparklesIcon className="size-5 text-accent" />
            </div>
            <div className="grid gap-3">
              {[
                'Portfolio draft ready',
                '3 applications need follow-up',
                'Resume tuned for product roles',
              ].map((item) => (
                <div key={item} className="rounded-md border border-border bg-muted/40 p-3">
                  <p className="body-3 text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="space-y-1 p-5">
              <div className="heading-2 text-foreground">{stat.value}</div>
              <div className="body-4 text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="heading-1 text-foreground">Everything stays connected</h2>
          <p className="body-2 max-w-2xl text-muted-foreground">
            The app combines portfolio editing, career history, and application tracking in one
            coherent workflow.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex size-10 items-center justify-center rounded-md border border-accent/30 bg-accent/10">
                    <Icon className="size-5 text-accent" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="heading-4 text-foreground">{feature.title}</h3>
                    <p className="body-3 text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="rounded-md border p-6 text-center sm:p-10">
        <div className="mx-auto max-w-2xl space-y-5">
          <h2 className="heading-1 text-foreground">Ready to build your portfolio?</h2>
          <p className="body-2 text-muted-foreground">
            Start with onboarding, publish when you are ready, and keep refining as your search
            evolves.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/onboarding" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
              Create Your Portfolio
            </Link>
            <Link to="/demo" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              Explore Example
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
          <span className="font-medium text-foreground">Craftd</span>
          <nav className="flex items-center gap-6">
            <Link to="/account" className="hover:text-foreground">
              Account
            </Link>
            <Link to="/onboarding" className="hover:text-foreground">
              Create
            </Link>
            <Link to="/demo" className="hover:text-foreground">
              Demo
            </Link>
          </nav>
          <span>2026 Craftd</span>
        </div>
      </footer>
    </div>
  );
}
