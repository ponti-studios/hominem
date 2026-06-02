import type { CareerEventRecord as CareerEvent } from '@hominem/db'
import type { CareerProgressionSummary, WorkExperienceWithFinancials } from '~/types/career-data'
import {
  extractWorkExperiences,
  type getUserCareerEvents,
  type getUserWorkExperiences,
} from './base'
import { calculatePercentageChange, getCurrentSalary, safeParseJson, yearsBetween } from './utils'

function toDate(value: Date | string | null | undefined) {
  return value ? new Date(value) : null
}

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
  const firstExp = workExps[0]
  const currentExp = workExps.find((experience) => !experience.endDate) || workExps[workExps.length - 1]
  const firstSalary = firstExp.baseSalary || 0
  const currentSalary = getCurrentSalary(currentExp)
  const totalSalaryGrowth = currentSalary - firstSalary
  const salaryGrowthPercentage = calculatePercentageChange(firstSalary, currentSalary)
  const careerStart = firstExp.startDate ? new Date(firstExp.startDate) : new Date()
  const totalExperience = yearsBetween(careerStart)
  const averageAnnualGrowth = totalExperience > 0 ? salaryGrowthPercentage / totalExperience : 0
  const promotionEvents = events.filter((event) => event.eventType === 'promotion')
  const jobChangeCount = workExps.length - 1
  const { totalTenure, completedJobs } = calculateTotalTenure(workExps)
  const averageTenurePerJob = completedJobs > 0 ? totalTenure / completedJobs : 0
  const highestIncrease = findHighestSalaryIncrease(events)
  const salaryByYear = buildSalaryByYear(workExps)
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
      totalTenure += yearsBetween(startDate, endDate)
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
        date: toDate(event.eventDate)?.toISOString() || '',
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

    for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year++) {
      const yearStart = new Date(year, 0, 1)
      const yearEnd = new Date(year, 11, 31)
      const periodStart = startDate > yearStart ? startDate : yearStart
      const periodEnd = endDate < yearEnd ? endDate : yearEnd
      const monthsWorked = calculateMonthsWorked(periodStart, periodEnd)
      const monthlyFraction = monthsWorked / 12
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

  let months = (endYear - startYear) * 12 + (endMonth - startMonth)

  if (endDay >= startDay) {
    months += 1
  } else {
    const daysInEndMonth = new Date(endYear, endMonth + 1, 0).getDate()
    months += endDay / daysInEndMonth
  }

  if (startDay > 1) {
    const daysInStartMonth = new Date(startYear, startMonth + 1, 0).getDate()
    const daysWorkedInStartMonth = daysInStartMonth - startDay + 1
    months = months - 1 + daysWorkedInStartMonth / daysInStartMonth
  }

  return Math.max(0, months)
}

function buildLevelProgression(workExps: ReturnType<typeof extractWorkExperiences>) {
  const levelProgression: CareerProgressionSummary['levelProgression'] = []

  for (let index = 0; index < workExps.length; index++) {
    const exp = workExps[index]
    if (exp.seniorityLevel && exp.startDate) {
      const nextExp = workExps[index + 1]
      const startDate = exp.startDate
      const endDate = exp.endDate || nextExp?.startDate || null
      const duration = endDate
        ? Math.round(yearsBetween(new Date(startDate), new Date(endDate)) * 12)
        : Math.round(yearsBetween(new Date(startDate)) * 12)

      levelProgression.push({
        level: exp.seniorityLevel,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
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
    const currentSalary = getCurrentSalary(exp)
    const bonuses = safeParseJson(exp.bonusHistory, []) as Array<{
      type: 'annual' | 'signing' | 'performance' | 'retention' | 'spot'
      amount: number
      date: string
      description?: string
    }>
    const totalBonuses = bonuses.reduce((sum: number, bonus) => sum + (bonus.amount || 0), 0)
    const yearsWorked = yearsBetween(startDate, endDate)
    const totalCompensationReceived = currentSalary * yearsWorked + totalBonuses
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
        ? adjustments.reduce((sum: number, adjustment) => sum + adjustment.increasePercentage, 0) /
          adjustments.length
        : 0
    const promotionCount = adjustments.filter((adjustment) => adjustment.reason === 'promotion').length
    const metadata = safeParseJson(exp.metadata, {}) as {
      achievements?: string[]
      technologies?: string[]
      projects?: Array<{ technologies: string[] }>
      certifications_earned?: string[]
    }
    const skillsAcquired = [
      ...(metadata.technologies || []),
      ...(metadata.certifications_earned || []),
      ...(metadata.projects?.flatMap((project) => project.technologies) || []),
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
  const timelineItems = []

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

  return timelineItems.sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
}
