/**
 * Centralized exports for all career query modules
 */

// Utility functions
export * from './utils'

// Base query functions
export * from './base'

// Project management
export * from './projects'

// Financial metrics
export {
  getCompensationBreakdown,
  getFinancialMetrics,
  getSalaryProgressionData,
} from './financial'

// Career progression
export {
  getCareerProgressionSummary,
  getCareerTimeline,
  getWorkExperiencesWithFinancials,
} from './career-progression'

// Job applications
export {
  getAllApplicationsWithCompany,
  getApplicationsByTimeframe,
  getAverageApplicationCycleTime,
  getJobApplicationFunnel,
  getJobApplicationMetrics,
  getTopCompaniesAppliedTo,
} from './job-applications'

// Legacy function for backward compatibility
export async function getRecentCareerEvents(userId: string, limit = 10) {
  const { getUserCareerEvents } = await import('./base')
  return getUserCareerEvents(userId, limit)
}
