import type { CareerEvent, CareerProgressionSummary, WorkExperienceWithFinancials } from '../schema'
import {
  extractWorkExperiences,
  type getUserCareerEvents,
  type getUserWorkExperiences,
} from './base'
import { calculatePercentageChange, getCurrentSalary, safeParseJson, yearsBetween } from './utils'

/**
 * Career progression and experience tracking queries
 */

export function getCareerProgressionSummary(
  experiencesResult: Awaited<ReturnType<typeof getUserWorkExperiences>>,
  eventsResult: Awaited<ReturnType<typeof getUserCareerEvents>>
): CareerProgressionSummary {
  if (experiencesResult.length === 0) {
    return {
      totalExperience: 0,
      currentSalary: 0,
      firstSalary: 0,
      totalSalaryGrowth: 0,
      salaryGrowthPercentage: 0,
      averageAnnualGrowth: 0,
      promotionCount: 0,
      jobChangeCount: 0,
      averageTenurePerJob: 0,
      highestSalaryIncrease: {
        amount: 0,
        percentage: 0,
        reason: '',
        date: '',
      },
      salaryByYear: [],
      currentLevel: '',
      levelProgression: [],
    }
  }

  const workExps = extractWorkExperiences(experiencesResult)
  const events = eventsResult

  // Calculate basic metrics
  const firstExp = workExps[0]
  const currentExp = workExps.find((e) => !e.endDate) || workExps[workExps.length - 1]

  const firstSalary = firstExp.baseSalary || 0
  const currentSalary = getCurrentSalary(currentExp)
  const totalSalaryGrowth = currentSalary - firstSalary
  const salaryGrowthPercentage = calculatePercentageChange(firstSalary, currentSalary)

  // Calculate total experience
  const careerStart = firstExp.startDate ? new Date(firstExp.startDate) : new Date()
  const totalExperience = yearsBetween(careerStart)

  const averageAnnualGrowth = totalExperience > 0 ? salaryGrowthPercentage / totalExperience : 0

  // Count promotions and job changes
  const promotionEvents = events.filter((e) => e.eventType === 'promotion')
  const jobChangeCount = workExps.length - 1

  // Calculate average tenure
  const { totalTenure, completedJobs } = calculateTotalTenure(workExps)
  const averageTenurePerJob = completedJobs > 0 ? totalTenure / completedJobs : 0

  // Find highest salary increase
  const highestIncrease = findHighestSalaryIncrease(events)

  // Build salary by year
  const salaryByYear = buildSalaryByYear(workExps)

  // Build level progression
  const levelProgression = buildLevelProgression(workExps)

  return {
    totalExperience,
    currentSalary,
    firstSalary,
    totalSalaryGrowth,
    salaryGrowthPercentage,
    averageAnnualGrowth,
    promotionCount: promotionEvents.length,
    jobChangeCount,
    averageTenurePerJob,
    highestSalaryIncrease: highestIncrease,
    salaryByYear,
    currentLevel: currentExp.seniorityLevel || '',
    levelProgression,
  }
}

function calculateTotalTenure(workExps: ReturnType<typeof extractWorkExperiences>) {
  let totalTenure = 0
  let completedJobs = 0

  for (const exp of workExps) {
    if (exp.startDate) {
      const endDate = exp.endDate ? new Date(exp.endDate) : new Date()
      const startDate = new Date(exp.startDate)
      const tenure = yearsBetween(startDate, endDate)
      totalTenure += tenure
      completedJobs++
    }
  }

  return { totalTenure, completedJobs }
}

function findHighestSalaryIncrease(events: CareerEvent[]) {
  let highestIncrease = {
    amount: 0,
    percentage: 0,
    reason: '',
    date: '',
  }

  for (const event of events) {
    if (event.salaryIncrease && event.salaryIncrease > highestIncrease.amount) {
      highestIncrease = {
        amount: event.salaryIncrease,
        percentage: Number.parseFloat(event.increasePercentage || '0'),
        reason: event.eventType || '',
        date: event.eventDate?.toISOString() || '',
      }
    }
  }

  return highestIncrease
}

function buildSalaryByYear(workExps: ReturnType<typeof extractWorkExperiences>) {
  const salaryByYear: CareerProgressionSummary['salaryByYear'] = []

  for (const exp of workExps) {
    if (!exp.startDate || !exp.baseSalary) continue

    const startDate = new Date(exp.startDate)
    const endDate = exp.endDate ? new Date(exp.endDate) : new Date()

    const startYear = startDate.getFullYear()
    const endYear = endDate.getFullYear()

    for (let year = startYear; year <= endYear; year++) {
      // Calculate the actual months worked in this year
      const yearStart = new Date(year, 0, 1) // January 1st of the year
      const yearEnd = new Date(year, 11, 31) // December 31st of the year

      // Find the overlap between the employment period and this year
      const periodStart = startDate > yearStart ? startDate : yearStart
      const periodEnd = endDate < yearEnd ? endDate : yearEnd

      // Calculate months worked in this year
      const monthsWorked = calculateMonthsWorked(periodStart, periodEnd)
      const monthlyFraction = monthsWorked / 12

      // Prorate the salary and total compensation
      const annualSalary = getCurrentSalary(exp)
      const annualTotalComp = exp.totalCompensation || annualSalary

      salaryByYear.push({
        year,
        salary: Math.round(annualSalary * monthlyFraction),
        totalComp: Math.round(annualTotalComp * monthlyFraction),
        company: exp.company,
        title: exp.role,
      })
    }
  }

  return salaryByYear
}

function calculateMonthsWorked(startDate: Date, endDate: Date): number {
  const startYear = startDate.getFullYear()
  const startMonth = startDate.getMonth()
  const startDay = startDate.getDate()

  const endYear = endDate.getFullYear()
  const endMonth = endDate.getMonth()
  const endDay = endDate.getDate()

  // Calculate total months between the dates
  let months = (endYear - startYear) * 12 + (endMonth - startMonth)

  // Add partial months based on days
  // If the end day is greater than or equal to start day, we have a full month
  // Otherwise, we need to subtract a fraction
  if (endDay >= startDay) {
    months += 1 // Include the final month
  } else {
    // Calculate the fraction of the final month
    const daysInEndMonth = new Date(endYear, endMonth + 1, 0).getDate()
    const fractionOfMonth = endDay / daysInEndMonth
    months += fractionOfMonth
  }

  // Handle the starting month fraction
  if (startDay > 1) {
    const daysInStartMonth = new Date(startYear, startMonth + 1, 0).getDate()
    const daysWorkedInStartMonth = daysInStartMonth - startDay + 1
    const startMonthFraction = daysWorkedInStartMonth / daysInStartMonth
    months = months - 1 + startMonthFraction
  }

  return Math.max(0, months)
}

function buildLevelProgression(workExps: ReturnType<typeof extractWorkExperiences>) {
  const levelProgression: CareerProgressionSummary['levelProgression'] = []

  for (let i = 0; i < workExps.length; i++) {
    const exp = workExps[i]
    if (exp.seniorityLevel && exp.startDate) {
      const nextExp = workExps[i + 1]
      const startDate = exp.startDate
      const endDate = exp.endDate || nextExp?.startDate || null

      const duration = endDate
        ? Math.round(yearsBetween(new Date(startDate), new Date(endDate)) * 12)
        : Math.round(yearsBetween(new Date(startDate)) * 12)

      levelProgression.push({
        level: exp.seniorityLevel,
        startDate: startDate.toISOString(),
        endDate: endDate?.toISOString() || undefined,
        duration,
      })
    }
  }

  return levelProgression
}

export function getWorkExperiencesWithFinancials(
  experiencesResult: Awaited<ReturnType<typeof getUserWorkExperiences>>
): WorkExperienceWithFinancials[] {
  const workExps = extractWorkExperiences(experiencesResult)

  return workExps.map((exp) => {
    const startDate = exp.startDate ? new Date(exp.startDate) : new Date()
    const endDate = exp.endDate ? new Date(exp.endDate) : new Date()
    const totalTenure = Math.round(yearsBetween(startDate, endDate) * 365)

    // Calculate annualized salary accounting for raises
    const currentSalary = getCurrentSalary(exp)

    // Calculate total compensation received
    const bonuses = safeParseJson(exp.bonusHistory, []) as Array<{
      type: 'annual' | 'signing' | 'performance' | 'retention' | 'spot'
      amount: number
      date: string
      description?: string
    }>
    const totalBonuses = bonuses.reduce((sum: number, b) => sum + (b.amount || 0), 0)
    const yearsWorked = yearsBetween(startDate, endDate)
    const totalCompensationReceived = currentSalary * yearsWorked + totalBonuses

    // Calculate average annual raise
    const adjustments = safeParseJson(exp.salaryAdjustments, []) as Array<{
      effectiveDate: string
      previousSalary: number
      newSalary: number
      increaseAmount: number
      increasePercentage: number
      reason:
        | 'promotion'
        | 'merit_increase'
        | 'market_adjustment'
        | 'cost_of_living'
        | 'role_change'
      newTitle?: string
      notes?: string
    }>
    const averageAnnualRaise =
      adjustments.length > 0
        ? adjustments.reduce((sum: number, adj) => sum + adj.increasePercentage, 0) /
          adjustments.length
        : 0

    // Count promotions
    const promotionCount = adjustments.filter((adj) => adj.reason === 'promotion').length

    // Extract skills from metadata
    const metadata = safeParseJson(exp.metadata, {}) as {
      company_size?: string
      industry?: string
      location?: string
      website?: string
      achievements?: string[]
      technologies?: string[]
      projects?: Array<{
        id: string
        title: string
        description: string
        status: string
        technologies: string[]
        impact: string
        createdAt: string
        updatedAt?: string
      }>
      certifications_earned?: string[]
    }
    const skillsAcquired = [
      ...(metadata.technologies || []),
      ...(metadata.certifications_earned || []),
      // Extract technologies from projects
      ...(metadata.projects?.flatMap((p) => p.technologies) || []),
    ]

    return {
      ...exp,
      totalTenure,
      currentAnnualizedSalary: currentSalary,
      totalCompensationReceived,
      averageAnnualRaise,
      promotionCount,
      skillsAcquired,
    }
  })
}

export function getCareerTimeline(
  experiencesResult: Awaited<ReturnType<typeof getUserWorkExperiences>>,
  eventsResult: Awaited<ReturnType<typeof getUserCareerEvents>>
) {
  const workExps = extractWorkExperiences(experiencesResult)
  const events = eventsResult

  // Combine work experiences and career events into a timeline
  const timelineItems = []

  // Add work experience start/end events
  for (const exp of workExps) {
    if (exp.startDate) {
      timelineItems.push({
        date: exp.startDate,
        type: 'job_start',
        title: `Started at ${exp.company}`,
        description: `${exp.role} - $${getCurrentSalary(exp).toLocaleString()}`,
        company: exp.company,
        role: exp.role,
        salary: getCurrentSalary(exp),
      })
    }

    if (exp.endDate) {
      timelineItems.push({
        date: exp.endDate,
        type: 'job_end',
        title: `Left ${exp.company}`,
        description: exp.reasonForLeaving || 'Job ended',
        company: exp.company,
      })
    }
  }

  // Add career events
  for (const event of events) {
    if (event.eventDate) {
      timelineItems.push({
        date: event.eventDate,
        type: event.eventType,
        title: event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1),
        description: event.description || '',
        salaryChange: event.salaryIncrease || 0,
        percentage: event.increasePercentage || '',
      })
    }
  }

  // Sort by date
  return timelineItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}
