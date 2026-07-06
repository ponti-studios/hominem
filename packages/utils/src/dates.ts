export function formatDateForInput(date: string | Date | null | undefined): string | undefined {
  if (!date) return undefined;
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(dateObj.getTime())) return undefined;
    return dateObj.toISOString().split('T')[0];
  } catch {
    return undefined;
  }
}

export function stringToDate(dateString?: string): Date | undefined {
  if (!dateString) return undefined;
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function adjustDateRange(
  dateFrom?: Date,
  dateTo?: Date,
): { adjustedDateFrom?: Date | undefined; adjustedDateTo?: Date | undefined } {
  if (!(dateFrom && dateTo)) {
    const result: { adjustedDateFrom?: Date; adjustedDateTo?: Date } = {};
    if (dateFrom) result.adjustedDateFrom = dateFrom;
    if (dateTo) result.adjustedDateTo = dateTo;
    return result;
  }

  const now = new Date();
  const isCurrentMonth =
    dateTo.getMonth() === now.getMonth() && dateTo.getFullYear() === now.getFullYear();

  let adjustedDateTo = dateTo;

  if (isCurrentMonth) {
    adjustedDateTo = new Date(dateTo.getFullYear(), dateTo.getMonth() + 1, 0);
  }

  return { adjustedDateFrom: dateFrom, adjustedDateTo };
}

export function getLastMonthFromRange(dateFrom?: Date, dateTo?: Date) {
  void dateFrom;
  if (!dateTo) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  return `${dateTo.getFullYear()}-${String(dateTo.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthYear(dateString: string) {
  const [yearStr, monthStr] = dateString.split('-');
  if (!(yearStr && monthStr)) {
    return '';
  }

  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10) - 1;

  if (Number.isNaN(year) || Number.isNaN(month)) {
    return '';
  }

  const date = new Date(year, month, 1);
  const currentYear = new Date().getFullYear();

  if (year === currentYear) {
    return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(date);
}
