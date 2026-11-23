import { formatCurrency } from '@hominem/utils/numbers';

import { StatusTone } from '~/modules/career/components/patterns';

export function getCompanyName(
  company: string | { name?: string | null } | null | undefined,
): string {
  if (!company) return 'Unknown Company';
  if (typeof company === 'string') return company;
  return company.name || 'Unknown Company';
}

const APPLICATION_STATUS_TONE: Record<string, StatusTone> = {
  WISHLIST: 'neutral',
  APPLIED: 'info',
  SCREENING: 'info',
  ACTIVE: 'info',
  INTERVIEW: 'info',
  INTERVIEWING: 'info',
  FINAL_INTERVIEW: 'info',
  PHONE_SCREEN: 'warning',
  OFFER: 'success',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  WITHDREW: 'neutral',
  WITHDRAWN: 'neutral',
};

// Statuses come in from the warehouse in mixed case ('active', 'APPLIED',
// 'INTERVIEWING'), so we normalize before looking up the tone.
export function getApplicationStatusTone(status: string): StatusTone {
  return APPLICATION_STATUS_TONE[status.toUpperCase()] ?? 'neutral';
}

export function formatApplicationDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatApplicationSalary(salary: number | string | null | undefined): string {
  if (!salary) return '—';
  if (typeof salary === 'string') return salary;
  return formatCurrency(salary);
}
