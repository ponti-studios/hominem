import { centsToDollars, formatCurrency } from '~/lib/utils'

/**
 * Get a standardized company name from various company data formats
 */
export function getCompanyName(company: string | { name: string } | null | undefined): string {
  if (!company) return 'Unknown Company'
  if (typeof company === 'string') return company
  return company.name || 'Unknown Company'
}

/**
 * Get the appropriate CSS classes for status badge styling
 */
export function getStatusColor(status: string): string {
  const colors = {
    APPLIED: 'bg-blue-100 text-blue-800',
    PHONE_SCREEN: 'bg-yellow-100 text-yellow-800',
    INTERVIEW: 'bg-purple-100 text-purple-800',
    FINAL_INTERVIEW: 'bg-indigo-100 text-indigo-800',
    OFFER: 'bg-green-100 text-green-800',
    ACCEPTED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
    WITHDRAWN: 'bg-gray-100 text-gray-800',
  }
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
}

/**
 * Format a date for display in the application table
 */
export function formatApplicationDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Format salary values for display
 */
export function formatApplicationSalary(salary: number | string | null | undefined): string {
  if (!salary) return '—'
  if (typeof salary === 'string') return salary
  return formatCurrency(centsToDollars(salary))
}

/**
 * Extract unique statuses from applications array
 */
export function getUniqueStatuses(applications: Array<{ status: string }>): string[] {
  return Array.from(new Set(applications.map((app) => app.status))).sort()
}

/**
 * Extract unique sources from applications array, filtering out null/undefined values
 */
export function getUniqueSources(
  applications: Array<{ source?: string | null | undefined }>
): string[] {
  return Array.from(
    new Set(
      applications.map((app) => app.source).filter((source): source is string => Boolean(source))
    )
  ).sort()
}

/**
 * Check if any filters are currently active
 */
export function hasActiveFilters(filters: {
  search?: string
  statuses?: string[]
  source?: string
}): boolean {
  return !!(filters.search || (filters.statuses && filters.statuses.length > 0) || filters.source)
}

/**
 * Format status text for display (replace underscores with spaces)
 */
export function formatStatusText(status: string): string {
  return status.replace('_', ' ')
}
