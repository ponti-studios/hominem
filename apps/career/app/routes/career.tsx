import type { LoaderFunctionArgs } from 'react-router'
import { Link, useLoaderData } from 'react-router'
import { CareerHistory } from '~/components/career/CareerHistory'
import { SalaryChart } from '~/components/career/SalaryChart'
import { StatCard } from '~/components/career/StatCard'
import {
  getCareerProgressionSummary,
  getCareerTimeline,
  getWorkExperiencesWithFinancials,
} from '~/lib/db/queries/career-progression'
import type { CareerProgressionSummary, WorkExperienceWithFinancials } from '~/lib/db/schema'
import { createSuccessResponse, withAuthLoader } from '~/lib/route-utils'
import { formatCurrency, formatPercentage } from '~/lib/utils'

interface LoaderData {
  user: { id: string; email?: string | null; name?: string | null }
  careerSummary: CareerProgressionSummary
  workExperiences: WorkExperienceWithFinancials[]
  careerTimeline: Array<{
    date: string
    type: string
    title: string
    description: string
    company?: string
    role?: string
    salary?: number
    salaryChange?: number
    percentage?: string
  }>
}

export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user }) => {
    try {
      // Import the base functions here to avoid module issues
      const { getUserCareerEvents, getUserWorkExperiences } = await import('~/lib/db/queries/base')

      // Make single calls to get the base data
      const [experiencesResult, eventsResult] = await Promise.all([
        getUserWorkExperiences(user.id),
        getUserCareerEvents(user.id),
      ])

      // Pass the data to the processing functions
      const [careerSummary, workExperiences, careerTimeline] = [
        getCareerProgressionSummary(experiencesResult, eventsResult),
        getWorkExperiencesWithFinancials(experiencesResult),
        getCareerTimeline(experiencesResult, eventsResult),
      ]

      // Convert dates to strings to avoid serialization issues
      const serializedWorkExperiences = workExperiences.map((exp) => ({
        ...exp,
        startDate: exp.startDate?.toISOString() || null,
        endDate: exp.endDate?.toISOString() || null,
        createdAt: exp.createdAt?.toISOString() || null,
        updatedAt: exp.updatedAt?.toISOString() || null,
      }))

      const serializedCareerTimeline = careerTimeline.map((item) => ({
        ...item,
        date: typeof item.date === 'string' ? item.date : new Date(item.date).toISOString(),
      }))

      const responseData = {
        user,
        careerSummary,
        workExperiences: serializedWorkExperiences,
        careerTimeline: serializedCareerTimeline,
      }

      return createSuccessResponse(responseData)
    } catch (error) {
      console.error('Error loading career data:', error)
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
      })
    }
  })
}

export default function CareerDashboard() {
  const response = useLoaderData<{ success: boolean; data: LoaderData }>()
  const data = response?.data || {}
  const { careerSummary, workExperiences, careerTimeline } = data

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
  }

  const summary = careerSummary || defaultSummary
  const experiences = workExperiences || []
  const timeline = careerTimeline || []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200/50 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-light text-slate-900 font-serif">Your Career</h1>
          </div>
          <nav className="hidden sm:flex items-center space-x-8">
            <Link
              to="/career/applications"
              className="text-slate-600 hover:text-slate-900 font-medium transition-colors duration-200 font-sans"
            >
              Applications
            </Link>
            <Link
              to="/projects"
              className="text-slate-600 hover:text-slate-900 font-medium transition-colors duration-200 font-sans"
            >
              Projects
            </Link>
          </nav>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-light text-slate-900 font-serif">Salary Progression</h2>
            <span className="text-sm text-slate-500 font-sans">By Year</span>
          </div>
          <SalaryChart data={summary.salaryByYear} />
        </div>
      ) : null}

      {/* Highest Salary Increase Highlight */}
      {summary.highestSalaryIncrease.amount > 0 && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium font-sans opacity-90">Biggest Career Win</h3>
              <p className="text-3xl font-light font-serif mt-2">
                +{formatCurrency(summary.highestSalaryIncrease.amount / 100)}
              </p>
              <p className="text-emerald-100 mt-1 font-sans">
                {formatPercentage(summary.highestSalaryIncrease.percentage)} increase •{' '}
                {summary.highestSalaryIncrease.reason}
              </p>
            </div>
            <div className="text-right opacity-75">
              <p className="text-sm font-sans">
                {new Date(summary.highestSalaryIncrease.date).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Career History - Combined Timeline and Experiences */}
      <CareerHistory workExperiences={experiences} careerTimeline={timeline} />
    </div>
  )
}
