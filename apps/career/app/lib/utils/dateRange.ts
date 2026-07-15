import { formatMonthYear } from '~/lib/career/work-experience-form';

export function formatDateRange(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
) {
  return `${formatMonthYear(startDate) ?? 'Present'} - ${formatMonthYear(endDate) ?? 'Present'}`;
}
