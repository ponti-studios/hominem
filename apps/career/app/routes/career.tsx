import { Badge } from '@hominem/ui/badge';
import { buttonVariants } from '@hominem/ui/button';
import { Card, CardContent, CardHeader } from '@hominem/ui/card';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, useLoaderData } from 'react-router';

import { CareerHistory } from '~/components/career/CareerHistory';
import { SalaryChart } from '~/components/career/SalaryChart';
import { StatCard } from '~/components/career/StatCard';
import {
  getCareerProgressionSummary,
  getWorkExperiencesWithFinancials,
} from '~/lib/career/queries/career-progression';
import { createSuccessResponse, withAuthLoader } from '~/lib/route-utils';
import { formatCurrency, formatPercentage } from '~/lib/utils';
import type { CareerProgressionSummary, WorkExperienceWithFinancials } from '~/types/career-data';

interface LoaderData {
  user: { id: string; email?: string | null; name?: string | null };
  careerSummary: CareerProgressionSummary;
  workExperiences: WorkExperienceWithFinancials[];
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

      const careerSummary = getCareerProgressionSummary(experiencesResult, eventsResult);
      const workExperiences = getWorkExperiencesWithFinancials(experiencesResult);

      const serializedWorkExperiences = workExperiences.map((exp) => ({
        ...exp,
        startDate: exp.startDate ? new Date(exp.startDate).toISOString() : null,
        endDate: exp.endDate ? new Date(exp.endDate).toISOString() : null,
        createdAt: exp.createdAt ? new Date(exp.createdAt).toISOString() : null,
        updatedAt: exp.updatedAt ? new Date(exp.updatedAt).toISOString() : null,
      }));

      const responseData = {
        user,
        careerSummary,
        workExperiences: serializedWorkExperiences,
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
      });
    }
  });
}

export default function CareerDashboard() {
  const response = useLoaderData<{ success: boolean; data: LoaderData }>();
  const data = response?.data || {};
  const { careerSummary, workExperiences } = data;

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Your Career</h1>
        <p className="text-sm text-muted-foreground">
          Review your experience, compensation growth, and career momentum.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          value={formatCurrency(summary.currentSalary / 100)}
          subtitle="compensation"
        />
        <StatCard
          value={summary.totalExperience.toFixed(1)}
          subtitle="yrs of experience"
        />
        <StatCard
          value={summary.averageTenurePerJob.toFixed(1)}
          subtitle="avg tenure"
        />
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

      {summary.highestSalaryIncrease.amount > 0 ? (
        <Card className="border-success/30 bg-success/10">
          <CardContent className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Biggest Career Win</p>
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

      <CareerHistory workExperiences={experiences} />
    </div>
  );
}
