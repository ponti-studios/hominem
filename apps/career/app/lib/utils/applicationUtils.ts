import { centsToDollars, formatCurrency } from '@hominem/utils/numbers';

/**
 * Get a standardized company name from various company data formats
 */
export function getCompanyName(company: string | { name: string } | null | undefined): string {
  if (!company) return 'Unknown Company';
  if (typeof company === 'string') return company;
  return company.name || 'Unknown Company';
}

/**
 * Get the appropriate CSS classes for status badge styling
 */
export function getStatusColor(status: string): string {
  const colors = {
    APPLIED: 'border-accent/30 bg-accent/10 text-foreground',
    PHONE_SCREEN: 'border-warning/30 bg-warning/10 text-foreground',
    INTERVIEW: 'border-accent/30 bg-accent/10 text-foreground',
    FINAL_INTERVIEW: 'border-accent/40 bg-accent/15 text-foreground',
    OFFER: 'border-success/30 bg-success/10 text-foreground',
    ACCEPTED: 'border-success/40 bg-success/15 text-foreground',
    REJECTED: 'border-destructive/30 bg-destructive/10 text-foreground',
    WITHDRAWN: 'bg-muted text-foreground',
  };
  return colors[status as keyof typeof colors] || 'bg-muted text-foreground';
}

/**
 * Format a date for display in the application table
 */
export function formatApplicationDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format salary values for display
 */
export function formatApplicationSalary(salary: number | string | null | undefined): string {
  if (!salary) return '—';
  if (typeof salary === 'string') return salary;
  return formatCurrency(centsToDollars(salary));
}

/**
 * Extract unique statuses from applications array
 */
export function getUniqueStatuses(applications: Array<{ status: string }>): string[] {
  return Array.from(new Set(applications.map((app) => app.status))).sort();
}

/**
 * Extract unique sources from applications array, filtering out null/undefined values
 */
export function getUniqueSources(
  applications: Array<{ source?: string | null | undefined }>,
): string[] {
  return Array.from(
    new Set(
      applications.map((app) => app.source).filter((source): source is string => Boolean(source)),
    ),
  ).sort();
}

/**
 * Check if any filters are currently active
 */
export function hasActiveFilters(filters: {
  search?: string;
  statuses?: string[];
  source?: string;
}): boolean {
  return !!(filters.search || (filters.statuses && filters.statuses.length > 0) || filters.source);
}

/**
 * Format status text for display (replace underscores with spaces)
 */
export function formatStatusText(status: string): string {
  return status.replace(/_/g, ' ');
}
