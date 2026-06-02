import type { ApplicationWithCompany } from '../../../types/applications'
import type { JobApplicationMetrics } from '../schema'
import {
  extractJobApplications,
  getUserJobApplications,
  type JobApplicationWithCompany,
} from './base'
import { calculatePercentageChange } from './utils'

// Filter and pagination types
export type JobApplicationFilter = {
  status?: string
  companyId?: string
  source?: string
  startDate?: Date
  endDate?: Date
  salaryMin?: number
  salaryMax?: number
}

export type PaginationOptions = {
  limit?: number
  offset?: number
  orderBy?: 'applicationDate' | 'responseDate' | 'offerDate' | 'companyName' | 'position'
  orderDirection?: 'asc' | 'desc'
}

export async function getJobApplicationMetrics(
  applications: ReturnType<typeof extractJobApplications>
): Promise<JobApplicationMetrics> {
  if (applications.length === 0) {
    return {
      totalApplications: 0,
      responseRate: 0,
      interviewRate: 0,
      offerRate: 0,
      acceptanceRate: 0,
      averageTimeToResponse: 0,
      averageTimeToOffer: 0,
      averageTimeToDecision: 0,
      salaryMetrics: {
        averageOffered: 0,
        averageAccepted: 0,
        negotiationSuccessRate: 0,
        averageNegotiationIncrease: 0,
      },
      sourceMetrics: [],
      statusBreakdown: [],
    }
  }

  const apps = applications
  const totalApplications = apps.length

  // Calculate conversion rates
  const responsesReceived = apps.filter((a) => a.responseDate).length
  const interviewsScheduled = apps.filter((a) => a.firstInterviewDate).length
  const offersReceived = apps.filter((a) => a.status === 'OFFER' || a.status === 'ACCEPTED').length
  const offersAccepted = apps.filter((a) => a.status === 'ACCEPTED').length

  const responseRate = (responsesReceived / totalApplications) * 100
  const interviewRate = (interviewsScheduled / totalApplications) * 100
  const offerRate = (offersReceived / totalApplications) * 100
  const acceptanceRate = offersReceived > 0 ? (offersAccepted / offersReceived) * 100 : 0

  // Calculate time metrics
  const timeMetrics = calculateTimeMetrics(apps)

  // Calculate salary metrics
  const salaryMetrics = calculateSalaryMetrics(apps, offersReceived)

  // Calculate source metrics
  const sourceMetrics = calculateSourceMetrics(apps)

  // Calculate status breakdown
  const statusBreakdown = calculateStatusBreakdown(apps, totalApplications)

  return {
    totalApplications,
    responseRate,
    interviewRate,
    offerRate,
    acceptanceRate,
    ...timeMetrics,
    salaryMetrics,
    sourceMetrics,
    statusBreakdown,
  }
}

function calculateTimeMetrics(apps: ReturnType<typeof extractJobApplications>) {
  const timeToResponseApps = apps.filter((a) => a.timeToResponse)
  const timeToOfferApps = apps.filter((a) => a.timeToOffer)
  const timeToDecisionApps = apps.filter((a) => a.timeToDecision)

  const averageTimeToResponse =
    timeToResponseApps.length > 0
      ? timeToResponseApps.reduce((sum, a) => sum + (a.timeToResponse || 0), 0) /
        timeToResponseApps.length
      : 0

  const averageTimeToOffer =
    timeToOfferApps.length > 0
      ? timeToOfferApps.reduce((sum, a) => sum + (a.timeToOffer || 0), 0) / timeToOfferApps.length
      : 0

  const averageTimeToDecision =
    timeToDecisionApps.length > 0
      ? timeToDecisionApps.reduce((sum, a) => sum + (a.timeToDecision || 0), 0) /
        timeToDecisionApps.length
      : 0

  return {
    averageTimeToResponse,
    averageTimeToOffer,
    averageTimeToDecision,
  }
}

function calculateSalaryMetrics(
  apps: ReturnType<typeof extractJobApplications>,
  offersReceived: number
) {
  const offeredSalaries = apps
    .filter((a): a is typeof a & { salaryOffered: number } => !!a.salaryOffered)
    .map((a) => a.salaryOffered)
  const acceptedSalaries = apps
    .filter((a): a is typeof a & { salaryFinal: number } => !!a.salaryFinal)
    .map((a) => a.salaryFinal)

  const averageOffered =
    offeredSalaries.length > 0
      ? offeredSalaries.reduce((sum, s) => sum + s, 0) / offeredSalaries.length
      : 0

  const averageAccepted =
    acceptedSalaries.length > 0
      ? acceptedSalaries.reduce((sum, s) => sum + s, 0) / acceptedSalaries.length
      : 0

  // Calculate negotiation success
  const negotiatedApps = apps.filter(
    (a) => a.salaryOffered && a.salaryNegotiated && a.salaryNegotiated > a.salaryOffered
  )

  const negotiationSuccessRate =
    offersReceived > 0 ? (negotiatedApps.length / offersReceived) * 100 : 0

  const averageNegotiationIncrease =
    negotiatedApps.length > 0
      ? negotiatedApps.reduce((sum, a) => {
          if (!a.salaryOffered || !a.salaryNegotiated) return sum
          const increase = calculatePercentageChange(a.salaryOffered, a.salaryNegotiated)
          return sum + increase
        }, 0) / negotiatedApps.length
      : 0

  return {
    averageOffered,
    averageAccepted,
    negotiationSuccessRate,
    averageNegotiationIncrease,
  }
}

function calculateSourceMetrics(apps: ReturnType<typeof extractJobApplications>) {
  const sourceMap = new Map<string, { count: number; responses: number; offers: number }>()

  for (const app of apps) {
    const source = app.source || 'unknown'
    const current = sourceMap.get(source) || {
      count: 0,
      responses: 0,
      offers: 0,
    }

    current.count++
    if (app.responseDate) current.responses++
    if (app.status === 'OFFER' || app.status === 'ACCEPTED') current.offers++

    sourceMap.set(source, current)
  }

  return Array.from(sourceMap.entries()).map(([source, data]) => ({
    source,
    count: data.count,
    responseRate: (data.responses / data.count) * 100,
    offerRate: (data.offers / data.count) * 100,
  }))
}

function calculateStatusBreakdown(
  apps: ReturnType<typeof extractJobApplications>,
  totalApplications: number
) {
  const statusMap = new Map<string, number>()

  for (const app of apps) {
    const status = app.status
    statusMap.set(status, (statusMap.get(status) || 0) + 1)
  }

  return Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
    percentage: (count / totalApplications) * 100,
  }))
}

export type JobApplicationFunnel = {
  stage: string
  count: number
  percentage: number
}
export async function getJobApplicationFunnel(userId: string): Promise<JobApplicationFunnel[]> {
  const applicationsResult = await getUserJobApplications(userId)
  const apps = extractJobApplications(applicationsResult)

  const funnel = [
    { stage: 'Applied', count: apps.length },
    { stage: 'Response', count: apps.filter((a) => a.responseDate).length },
    {
      stage: 'Phone Screen',
      count: apps.filter(
        (a) =>
          a.status === 'PHONE_SCREEN' ||
          (a.interviewDates && Array.isArray(a.interviewDates) && a.interviewDates.length > 0)
      ).length,
    },
    {
      stage: 'Interview',
      count: apps.filter((a) => a.firstInterviewDate).length,
    },
    {
      stage: 'Final Round',
      count: apps.filter((a) => a.status === 'FINAL_INTERVIEW').length,
    },
    {
      stage: 'Offer',
      count: apps.filter((a) => a.status === 'OFFER' || a.status === 'ACCEPTED').length,
    },
    {
      stage: 'Accepted',
      count: apps.filter((a) => a.status === 'ACCEPTED').length,
    },
  ]

  return funnel.map((stage) => ({
    ...stage,
    percentage: apps.length > 0 ? (stage.count / apps.length) * 100 : 0,
  }))
}

export type RecentApplication = JobApplicationWithCompany
export async function getApplicationsByTimeframe(
  userId: string,
  days = 30
): Promise<RecentApplication[]> {
  const applicationsResult = await getUserJobApplications(userId)
  const apps = extractJobApplications(applicationsResult)

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  return apps.filter((app) => app.applicationDate && new Date(app.applicationDate) >= cutoffDate)
}

export type TopCompany = {
  company: string
  count: number
  offers: number
  interviews: number
  offerRate: number
  interviewRate: number
}
export async function getTopCompaniesAppliedTo(userId: string, limit = 10) {
  const applicationsResult = await getUserJobApplications(userId)
  const apps = extractJobApplications(applicationsResult)

  const companyMap = new Map<string, { count: number; offers: number; interviews: number }>()

  for (const app of apps) {
    const companyName = app.company?.name || 'Unknown Company'
    const current = companyMap.get(companyName) || {
      count: 0,
      offers: 0,
      interviews: 0,
    }

    current.count++
    if (app.status === 'OFFER' || app.status === 'ACCEPTED') current.offers++
    if (app.firstInterviewDate) current.interviews++

    companyMap.set(companyName, current)
  }

  return Array.from(companyMap.entries())
    .map(([company, data]) => ({
      company,
      ...data,
      offerRate: (data.offers / data.count) * 100,
      interviewRate: (data.interviews / data.count) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export async function getAverageApplicationCycleTime(userId: string): Promise<number> {
  const applicationsResult = await getUserJobApplications(userId)
  const apps = extractJobApplications(applicationsResult)

  const completedApps = apps.filter(
    (app) =>
      app.applicationDate &&
      app.decisionDate &&
      (app.status === 'ACCEPTED' || app.status === 'REJECTED' || app.status === 'WITHDRAWN')
  )

  if (completedApps.length === 0) return 0

  const totalDays = completedApps.reduce((sum, app) => {
    if (!app.applicationDate || !app.decisionDate) return sum
    const start = new Date(app.applicationDate)
    const end = new Date(app.decisionDate)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return sum + days
  }, 0)

  return Math.round(totalDays / completedApps.length)
}

export async function getAllApplicationsWithCompany(
  userId: string,
  filter?: JobApplicationFilter,
  pagination?: PaginationOptions
): Promise<ApplicationWithCompany[]> {
  const { db } = await import('../index')
  const { companies, jobApplications } = await import('../schema')
  const { eq, and, gte, lte, desc, asc, or, sql } = await import('drizzle-orm')

  // Build where conditions
  const conditions = [eq(jobApplications.userId, userId)]

  if (filter) {
    if (filter.status) {
      conditions.push(eq(jobApplications.status, filter.status))
    }
    if (filter.companyId) {
      conditions.push(eq(jobApplications.companyId, filter.companyId))
    }
    if (filter.source) {
      conditions.push(eq(jobApplications.source, filter.source))
    }
    if (filter.startDate) {
      conditions.push(gte(jobApplications.applicationDate, filter.startDate))
    }
    if (filter.endDate) {
      conditions.push(lte(jobApplications.applicationDate, filter.endDate))
    }
    if (filter.salaryMin) {
      // Note: Salary filtering can be added later when needed
      // For now, skip to avoid TypeScript complexity
    }
    if (filter.salaryMax) {
      // Note: Salary filtering can be added later when needed
      // For now, skip to avoid TypeScript complexity
    }
  }

  // Create ordering SQL
  const orderColumn = pagination?.orderBy || 'applicationDate'
  const orderDirection = pagination?.orderDirection === 'asc' ? asc : desc

  let orderBySql: ReturnType<typeof asc | typeof desc>
  switch (orderColumn) {
    case 'applicationDate':
      orderBySql = orderDirection(jobApplications.applicationDate)
      break
    case 'responseDate':
      orderBySql = orderDirection(jobApplications.responseDate)
      break
    case 'offerDate':
      orderBySql = orderDirection(jobApplications.offerDate)
      break
    case 'companyName':
      orderBySql = orderDirection(companies.name)
      break
    case 'position':
      orderBySql = orderDirection(jobApplications.position)
      break
    default:
      orderBySql = desc(jobApplications.applicationDate)
  }

  // Build query step by step to avoid TypeScript issues
  const results = await db
    .select({
      id: jobApplications.id,
      userId: jobApplications.userId,
      position: jobApplications.position,
      companyId: jobApplications.companyId,
      company: companies.name,
      status: jobApplications.status,
      startDate: jobApplications.startDate,
      endDate: jobApplications.endDate,
      location: jobApplications.location,
      jobPosting: jobApplications.jobPosting,
      salaryQuoted: jobApplications.salaryQuoted,
      salaryAccepted: jobApplications.salaryAccepted,
      applicationDate: jobApplications.applicationDate,
      responseDate: jobApplications.responseDate,
      offerDate: jobApplications.offerDate,
      coverLetter: jobApplications.coverLetter,
      resume: jobApplications.resume,
      jobId: jobApplications.jobId,
      link: jobApplications.link,
      phoneScreen: jobApplications.phoneScreen,
      reference: jobApplications.reference,
      stages: jobApplications.stages,
      createdAt: jobApplications.createdAt,
      updatedAt: jobApplications.updatedAt,
    })
    .from(jobApplications)
    .leftJoin(companies, eq(jobApplications.companyId, companies.id))
    .where(and(...conditions))
    .orderBy(orderBySql)
    .$dynamic()
    .limit(pagination?.limit || 1000)
    .offset(pagination?.offset || 0)

  // Transform the results to match ApplicationWithCompany type
  return results.map((app) => ({
    ...app,
    company: app.company || undefined,
    companyId: app.companyId || '',
    endDate: app.endDate || undefined,
    location: app.location || undefined,
    jobPosting: app.jobPosting || undefined,
    salaryQuoted: app.salaryQuoted || undefined,
    salaryAccepted: app.salaryAccepted || undefined,
    coverLetter: app.coverLetter || undefined,
    resume: app.resume || undefined,
    jobId: app.jobId || undefined,
    link: app.link || undefined,
    phoneScreen: app.phoneScreen || undefined,
    createdAt: app.createdAt || undefined,
    updatedAt: app.updatedAt || undefined,
  })) as ApplicationWithCompany[]
}

/**
 * Helper function to get job application metrics for a user
 * This function fetches applications and then computes metrics
 */
export async function getJobApplicationMetricsForUser(
  userId: string
): Promise<JobApplicationMetrics> {
  const applicationsResult = await getUserJobApplications(userId)
  const applications = extractJobApplications(applicationsResult)
  return getJobApplicationMetrics(applications)
}

// Helper function to get all applications with companies for a user without filters
export async function getAllApplicationsWithCompanyForUser(
  userId: string
): Promise<ApplicationWithCompany[]> {
  return getAllApplicationsWithCompany(userId)
}
