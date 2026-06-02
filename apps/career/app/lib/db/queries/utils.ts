/**
 * Utility functions for career data calculations
 */

// Helper function to convert cents to dollars for display
export function centsToDollars(cents: number | null): number {
  return cents ? Math.round(cents / 100) : 0
}

// Helper function to convert dollars to cents for storage
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

// Helper function to calculate years between dates
export function yearsBetween(startDate: Date, endDate: Date = new Date()): number {
  const diffTime = endDate.getTime() - startDate.getTime()
  return diffTime / (1000 * 60 * 60 * 24 * 365.25)
}

// Helper function to calculate months between dates
export function monthsBetween(startDate: Date, endDate: Date = new Date()): number {
  const diffTime = endDate.getTime() - startDate.getTime()
  return diffTime / (1000 * 60 * 60 * 24 * 30.44) // Average days per month
}

// Helper function to get current or most recent salary from work experience
export function getCurrentSalary(experience: {
  baseSalary?: number | null
  salaryAdjustments?: unknown
}): number {
  if (!experience.baseSalary) return 0

  // Check for salary adjustments and return the most recent one
  const adjustments = experience.salaryAdjustments as {
    effectiveDate: string
    newSalary: number
  }[]
  if (adjustments && adjustments.length > 0) {
    const mostRecentAdjustment = adjustments.sort(
      (a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
    )[0]
    return mostRecentAdjustment.newSalary
  }

  return experience.baseSalary
}

// Helper function to calculate percentage change
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0
  return ((newValue - oldValue) / oldValue) * 100
}

// Helper function to calculate compound annual growth rate
export function calculateCAGR(initialValue: number, finalValue: number, years: number): number {
  if (initialValue <= 0 || finalValue <= 0 || years <= 0) return 0
  return ((finalValue / initialValue) ** (1 / years) - 1) * 100
}

// Helper function to extract bonuses for a specific year
export function getBonusesForYear(
  bonusHistory: { date: string; amount?: number }[],
  year: number
): number {
  if (!bonusHistory || !Array.isArray(bonusHistory)) return 0

  return bonusHistory
    .filter((bonus) => new Date(bonus.date).getFullYear() === year)
    .reduce((sum, bonus) => sum + (bonus.amount || 0), 0)
}

// Helper function to get years of employment from start/end dates
export function getEmploymentYears(
  startDate: string | Date | null,
  endDate: string | Date | null = null
): number[] {
  if (!startDate) return []

  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : new Date()

  const startYear = start.getFullYear()
  const endYear = end.getFullYear()

  const years: number[] = []
  for (let year = startYear; year <= endYear; year++) {
    years.push(year)
  }

  return years
}

// Helper function to safely parse JSON fields
export function safeParseJson<T>(jsonField: unknown, fallback: T): T {
  if (!jsonField) return fallback

  try {
    if (typeof jsonField === 'string') {
      return JSON.parse(jsonField) as T
    }
    return jsonField as T
  } catch (error) {
    console.error('Failed to parse JSON field:', error)
    return fallback
  }
}

// Helper function to format currency for display
export function formatCurrency(cents: number | null, currency = 'USD'): string {
  const dollars = centsToDollars(cents)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars)
}

// Helper function to format percentage
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

// Helper function to create date ranges for queries
export function createDateRange(startDate: string | Date, endDate?: string | Date | null) {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = endDate ? (typeof endDate === 'string' ? new Date(endDate) : endDate) : new Date()

  return { start, end }
}
