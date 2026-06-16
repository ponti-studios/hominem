import { Badge } from '@hominem/ui/badge';
import { buttonVariants } from '@hominem/ui/button';
import { Card, CardContent, CardHeader } from '@hominem/ui/card';
import { Link } from 'react-router';

import { CareerHistory } from '~/components/career/CareerHistory';
import { ActivityHeatmapCard } from '~/components/career/ActivityHeatmapCard';
import { ApplicationMetricsCard } from '~/components/career/ApplicationMetricsCard';
import { LevelProgressionChart } from '~/components/career/LevelProgressionChart';
import { SalaryChart } from '~/components/career/SalaryChart';
import { SourcePerformanceChart } from '~/components/career/SourcePerformanceChart';
import { StatCard } from '~/components/career/StatCard';
import { TopCompaniesInsights } from '~/components/career/TopCompaniesInsights';
import {
  getCareerProgressionSummary,
  getWorkExperiencesWithFinancials,
} from '~/lib/career/queries/career-progression';
import {
  getAllApplicationsWithCompany,
  getJobApplicationMetricsForUser,
  getTopCompaniesAppliedTo,
} from '~/lib/career/queries/job-applications';
import { userContext } from '~/lib/middleware';
import { formatCurrency, formatPercentage } from '@hominem/utils/numbers';
import { cn } from '~/lib/utils';
import type { CareerProgressionSummary, WorkExperienceWithFinancials } from '~/lib/career/queries/career-progression';

import { Route } from './+types/home';

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
  if (!user) return { authenticated: false as const };

  try {
    const { getUserCareerEvents, getUserWorkExperiences } =
      await import('~/lib/career/queries/base');

    const [experiencesResult, eventsResult, allApplications, metrics, topCompanies] =
      await Promise.all([
        getUserWorkExperiences(user.id),
        getUserCareerEvents(user.id),
        getAllApplicationsWithCompany(user.id),
        getJobApplicationMetricsForUser(user.id),
        getTopCompaniesAppliedTo(user.id),
      ]);

    const careerSummary = getCareerProgressionSummary(experiencesResult, eventsResult);
    const work_experiences = getWorkExperiencesWithFinancials(experiencesResult);

    const serializedWorkExperiences = work_experiences.map((exp) => ({
      ...exp,
      start_date: exp.start_date ? new Date(exp.start_date).toISOString() : null,
      end_date: exp.end_date ? new Date(exp.end_date).toISOString() : null,
      createdat: exp.createdat ? new Date(exp.createdat).toISOString() : null,
      updatedat: exp.updatedat ? new Date(exp.updatedat).toISOString() : null,
    }));

    return {
      authenticated: true as const,
      careerSummary,
      work_experiences: serializedWorkExperiences,
      allApplications,
      metrics,
      topCompanies,
    };
  } catch (error) {
    console.error('Error loading career data:', error);
    throw new Response('Failed to load career data', { status: 500 });
  }
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

export default function Home({ loaderData }: Route.ComponentProps) {
  if (loaderData.authenticated) {
    return <Dashboard loaderData={loaderData} />;
  }
  return <LandingPage />;
}

function Dashboard({
  loaderData,
}: {
  loaderData: Extract<Route.ComponentProps['loaderData'], { authenticated: true }>;
}) {
  const { careerSummary, work_experiences, allApplications, metrics, topCompanies } = loaderData;

  const defaultSummary: CareerProgressionSummary = {
    totalExperience: 0,
    currentSalary: 0,
    firstSalary: 0,
    totalSalaryGrowth: 0,
    salaryGrowthPercentage: 0,
    averageAnnualGrowth: 0,
    promotionCount: 0,
    jobChangeCount: 0,
    averageTenurePerJob: 0,
    highestSalaryIncrease: { amount: 0, percentage: 0, reason: '', date: '' },
    salaryByYear: [],
    currentLevel: '',
    levelProgression: [],
  };

  const summary = careerSummary || defaultSummary;
  const experiences = work_experiences || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Your Career</h1>
        <p className="text-sm text-muted-foreground">
          Review your experience, compensation growth, and career momentum.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard value={formatCurrency(summary.currentSalary / 100)} subtitle="compensation" />
        <StatCard value={summary.totalExperience.toFixed(1)} subtitle="yrs of experience" />
        <StatCard value={summary.averageTenurePerJob.toFixed(1)} subtitle="avg tenure" />
      </div>

      {summary.salaryByYear.length > 0 ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Salary Progression</h2>
            <Badge variant="outline">By year</Badge>
          </CardHeader>
          <CardContent>
            <SalaryChart data={summary.salaryByYear} />
          </CardContent>
        </Card>
      ) : null}

      {summary.levelProgression.length > 0 ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Level Progression</h2>
            <Badge variant="outline">By role</Badge>
          </CardHeader>
          <CardContent>
            <LevelProgressionChart data={summary.levelProgression} />
          </CardContent>
        </Card>
      ) : null}

      {summary.highestSalaryIncrease.amount > 0 ? (
        <Card className="border-success/30 bg-success/10">
          <CardContent className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Biggest Career Win
              </p>
              <p className="mt-1 text-2xl font-semibold">
                +{formatCurrency(summary.highestSalaryIncrease.amount / 100)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatPercentage(summary.highestSalaryIncrease.percentage)} increase ·{' '}
                {summary.highestSalaryIncrease.reason}
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 border-success/30">
              {new Date(summary.highestSalaryIncrease.date).toLocaleDateString()}
            </Badge>
          </CardContent>
        </Card>
      ) : null}

      <CareerHistory work_experiences={experiences as unknown as WorkExperienceWithFinancials[]} />

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Job Search</h2>
          <p className="text-sm text-muted-foreground">Application activity and pipeline performance.</p>
        </div>

        <div className="space-y-6">
          <ActivityHeatmapCard applications={allApplications} />
          <ApplicationMetricsCard applications={allApplications} metrics={metrics} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="overflow-hidden rounded-lg border border-border bg-card p-4">
            <SourcePerformanceChart data={metrics.sourceMetrics} />
          </div>
          <TopCompaniesInsights companies={topCompanies} />
        </div>
      </section>
    </div>
  );
}

function LandingPage() {
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
