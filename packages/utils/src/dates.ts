export function getTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getLocalDate(date: Date): { localDateString: string; localDate: Date } {
  const timeZone = getTimezone();

  const offset = new Date().getTimezoneOffset();
  const dateWithOffset = new Date(date.getTime() + offset * 60 * 1000);
  const localDate = new Date(
    dateWithOffset.getTime() - dateWithOffset.getTimezoneOffset() * 60 * 1000 * 2,
  );

  const localDateString = localDate.toLocaleString(undefined, {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });

  return { localDateString, localDate };
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
