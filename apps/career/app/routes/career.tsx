import { Badge } from '@hominem/ui/badge';
import { buttonVariants } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, useLoaderData } from 'react-router';

import { CareerHistory } from '~/components/career/CareerHistory';
import { SalaryChart } from '~/components/career/SalaryChart';
import { StatCard } from '~/components/career/StatCard';
import {
  getCareerProgressionSummary,
  getCareerTimeline,
  getWorkExperiencesWithFinancials,
} from '~/lib/career/queries/career-progression';
import { createSuccessResponse, withAuthLoader } from '~/lib/route-utils';
import { formatCurrency, formatPercentage } from '~/lib/utils';
import type { CareerProgressionSummary, WorkExperienceWithFinancials } from '~/types/career-data';

interface LoaderData {
  user: { id: string; email?: string | null; name?: string | null };
  careerSummary: CareerProgressionSummary;
  workExperiences: WorkExperienceWithFinancials[];
  careerTimeline: Array<{
    date: string;
    type: string;
    title: string;
    description: string;
    company?: string;
    role?: string;
    salary?: number;
    salaryChange?: number;
    percentage?: string;
  }>;
}

export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user }) => {
    try {
      // Import the base functions here to avoid module issues
      const { getUserCareerEvents, getUserWorkExperiences } =
        await import('~/lib/career/queries/base');

      // Make single calls to get the base data
      const [experiencesResult, eventsResult] = await Promise.all([
        getUserWorkExperiences(user.id),
        getUserCareerEvents(user.id),
      ]);

      // Pass the data to the processing functions
      const [careerSummary, workExperiences, careerTimeline] = [
        getCareerProgressionSummary(experiencesResult, eventsResult),
        getWorkExperiencesWithFinancials(experiencesResult),
        getCareerTimeline(experiencesResult, eventsResult),
      ];

      // Convert dates to strings to avoid serialization issues
      const serializedWorkExperiences = workExperiences.map((exp) => ({
        ...exp,
        startDate: exp.startDate ? new Date(exp.startDate).toISOString() : null,
        endDate: exp.endDate ? new Date(exp.endDate).toISOString() : null,
        createdAt: exp.createdAt ? new Date(exp.createdAt).toISOString() : null,
        updatedAt: exp.updatedAt ? new Date(exp.updatedAt).toISOString() : null,
      }));

      const serializedCareerTimeline = careerTimeline.map((item) => ({
        ...item,
        date: typeof item.date === 'string' ? item.date : new Date(item.date).toISOString(),
      }));

      const responseData = {
        user,
        careerSummary,
        workExperiences: serializedWorkExperiences,
        careerTimeline: serializedCareerTimeline,
      };

      return createSuccessResponse(responseData);
    } catch (error) {
      console.error('Error loading career data:', error);
      return createSuccessResponse({
        user,
        careerSummary: {
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
        },
        workExperiences: [],
        careerTimeline: [],
      });
    }
  });
}

export default function CareerDashboard() {
  const response = useLoaderData<{ success: boolean; data: LoaderData }>();
  const data = response?.data || {};
  const { careerSummary, workExperiences, careerTimeline } = data;

  // Provide default values if data is missing
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
  const experiences = workExperiences || [];
  const timeline = careerTimeline || [];

  return (
    <div className="space-y-8">
      <Card className="border-border bg-card ">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Badge variant="outline">Career dashboard</Badge>
            <div>
              <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Your Career</h1>
              <p className="text-sm text-muted-foreground">
                Review your experience, compensation growth, and career momentum.
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-3">
            <Link
              to="/career/applications"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Applications
            </Link>
            <Link to="/projects" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Projects
            </Link>
          </nav>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Current Salary"
          value={formatCurrency(summary.currentSalary / 100)}
          subtitle="Current compensation"
          trend="neutral"
        />
        <StatCard
          title="Years of Experience"
          value={`${summary.totalExperience.toFixed(1)}y`}
          subtitle="Total career experience"
          trend="neutral"
        />
        <StatCard
          title="Career Moves"
          value={summary.jobChangeCount.toString()}
          subtitle={`${summary.promotionCount} promotions`}
          trend="neutral"
        />
        <StatCard
          title="Average Tenure"
          value={`${summary.averageTenurePerJob.toFixed(1)}y`}
          subtitle={`${summary.jobChangeCount} job changes`}
          trend="neutral"
        />
      </div>

      {/* Salary Progression */}

      {summary.salaryByYear.length > 0 ? (
        <Card className="border-border bg-card ">
          <CardContent className="space-y-6 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold text-foreground">Salary Progression</h2>
              <Badge variant="outline">By year</Badge>
            </div>
            <SalaryChart data={summary.salaryByYear} />
          </CardContent>
        </Card>
      ) : null}

      {/* Highest Salary Increase Highlight */}
      {summary.highestSalaryIncrease.amount > 0 ? (
        <Card className="border-success/30 bg-success/10">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-medium text-foreground">Biggest Career Win</h3>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                +{formatCurrency(summary.highestSalaryIncrease.amount / 100)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatPercentage(summary.highestSalaryIncrease.percentage)} increase •{' '}
                {summary.highestSalaryIncrease.reason}
              </p>
            </div>
            <Badge variant="outline" className="border-success/30 bg-background/70 text-foreground">
              {new Date(summary.highestSalaryIncrease.date).toLocaleDateString()}
            </Badge>
          </CardContent>
        </Card>
      ) : null}

      {/* Career History - Combined Timeline and Experiences */}
      <CareerHistory workExperiences={experiences} careerTimeline={timeline} />
    </div>
  );
}
