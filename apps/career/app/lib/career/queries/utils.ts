export function centsToDollars(cents: number | null): number {
  return cents ? Math.round(cents / 100) : 0;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function yearsBetween(startDate: Date, endDate: Date = new Date()): number {
  const diffTime = endDate.getTime() - startDate.getTime();
  return diffTime / (1000 * 60 * 60 * 24 * 365.25);
}

export function monthsBetween(startDate: Date, endDate: Date = new Date()): number {
  const diffTime = endDate.getTime() - startDate.getTime();
  return diffTime / (1000 * 60 * 60 * 24 * 30.44);
}

export function getCurrentSalary(experience: {
  baseSalary?: number | null;
  salaryAdjustments?: unknown;
}): number {
  if (!experience.baseSalary) return 0;

  const adjustments = experience.salaryAdjustments as {
    effectiveDate: string;
    newSalary: number;
  }[];

  if (adjustments && adjustments.length > 0) {
    const mostRecentAdjustment = adjustments.sort(
      (left, right) =>
        new Date(right.effectiveDate).getTime() - new Date(left.effectiveDate).getTime(),
    )[0];
    return mostRecentAdjustment.newSalary;
  }

  return experience.baseSalary;
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
  bonusHistory: { date: string; amount?: number }[],
  year: number,
): number {
  if (!bonusHistory || !Array.isArray(bonusHistory)) return 0;

  return bonusHistory
    .filter((bonus) => new Date(bonus.date).getFullYear() === year)
    .reduce((sum, bonus) => sum + (bonus.amount || 0), 0);
}

export function getEmploymentYears(
  startDate: string | Date | null,
  endDate: string | Date | null = null,
): number[] {
  if (!startDate) return [];

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
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
    console.error('Failed to parse JSON field:', error);
    return fallback;
  }
}

export function formatCurrency(cents: number | null, currency = 'USD'): string {
  const dollars = centsToDollars(cents);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function createDateRange(startDate: string | Date, endDate?: string | Date | null) {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = endDate ? (typeof endDate === 'string' ? new Date(endDate) : endDate) : new Date();

  return { start, end };
}
