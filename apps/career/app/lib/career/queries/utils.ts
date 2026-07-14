import { logger } from '../../logger';

export function centsToDollars(cents: number | null): number {
  return cents ? Math.round(cents / 100) : 0;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function yearsBetween(start_date: Date, end_date: Date = new Date()): number {
  const diffTime = end_date.getTime() - start_date.getTime();
  return diffTime / (1000 * 60 * 60 * 24 * 365.25);
}

export function monthsBetween(start_date: Date, end_date: Date = new Date()): number {
  const diffTime = end_date.getTime() - start_date.getTime();
  return diffTime / (1000 * 60 * 60 * 24 * 30.44);
}

export function getCurrentSalary(experience: {
  baseSalary?: number | null;
  salaryAdjustments?: unknown;
}): number {
  const adjustments = safeParseJson<{ effectiveDate: string; newSalary: number }[]>(
    experience.salaryAdjustments,
    [],
  );

  if (adjustments.length > 0) {
    const mostRecentAdjustment = adjustments.reduce((mostRecent, adjustment) =>
      new Date(adjustment.effectiveDate).getTime() > new Date(mostRecent.effectiveDate).getTime()
        ? adjustment
        : mostRecent,
    );
    return mostRecentAdjustment.newSalary;
  }

  return experience.baseSalary ?? 0;
}

export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

export function calculateCAGR(initialValue: number, finalValue: number, years: number): number {
  if (initialValue <= 0 || finalValue <= 0 || years <= 0) return 0;
  return ((finalValue / initialValue) ** (1 / years) - 1) * 100;
}

export function getBonusesForYear(
  bonus_history: { date: string; amount?: number }[],
  year: number,
): number {
  if (!bonus_history || !Array.isArray(bonus_history)) return 0;

  return bonus_history
    .filter((bonus) => new Date(bonus.date).getFullYear() === year)
    .reduce((sum, bonus) => sum + (bonus.amount || 0), 0);
}

export function getEmploymentYears(
  start_date: string | Date | null,
  end_date: string | Date | null = null,
): number[] {
  if (!start_date) return [];

  const start = new Date(start_date);
  const end = end_date ? new Date(end_date) : new Date();
  const years: number[] = [];

  for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
    years.push(year);
  }

  return years;
}

export function safeParseJson<T>(jsonField: unknown, fallback: T): T {
  if (!jsonField) return fallback;

  try {
    if (typeof jsonField === 'string') {
      return JSON.parse(jsonField) as T;
    }

    return jsonField as T;
  } catch (error) {
    logger.error('Failed to parse JSON field', error);
    return fallback;
  }
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function createDateRange(start_date: string | Date, end_date?: string | Date | null) {
  const start = typeof start_date === 'string' ? new Date(start_date) : start_date;
  const end = end_date
    ? typeof end_date === 'string'
      ? new Date(end_date)
      : end_date
    : new Date();

  return { start, end };
}
