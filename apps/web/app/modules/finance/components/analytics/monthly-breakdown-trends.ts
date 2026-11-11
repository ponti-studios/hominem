import type { TimeSeriesDataPoint } from '@hominem/rpc/finance';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  isBefore,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

type GroupBy = 'month' | 'week' | 'day';

function getBucketBounds(date: string, groupBy: GroupBy) {
  const parsedDate = parseISO(groupBy === 'month' ? `${date}-01` : date);

  if (groupBy === 'month') {
    return { start: startOfMonth(parsedDate), end: endOfMonth(parsedDate) };
  }
  if (groupBy === 'week') {
    return {
      start: startOfWeek(parsedDate, { weekStartsOn: 1 }),
      end: endOfWeek(parsedDate, { weekStartsOn: 1 }),
    };
  }
  return { start: startOfDay(parsedDate), end: endOfDay(parsedDate) };
}

function areAdjacentBuckets(first: Date, second: Date, groupBy: GroupBy) {
  const nextBucket =
    groupBy === 'month'
      ? addMonths(first, 1)
      : groupBy === 'week'
        ? addWeeks(first, 1)
        : addDays(first, 1);
  return nextBucket.getTime() === second.getTime();
}

export function findLargestCompleteSpendingChange({
  data,
  dateFrom,
  dateTo,
  groupBy,
  now = new Date(),
}: {
  data: TimeSeriesDataPoint[];
  dateFrom?: Date;
  dateTo?: Date;
  groupBy: GroupBy;
  now?: Date;
}) {
  const rangeStart = dateFrom ? startOfDay(dateFrom) : undefined;
  const rangeEnd = dateTo ? endOfDay(dateTo) : undefined;
  const completed = data
    .map((item) => ({ item, ...getBucketBounds(item.date, groupBy) }))
    .filter(
      ({ start, end }) =>
        isBefore(end, startOfDay(now)) &&
        (!rangeStart || !isBefore(start, rangeStart)) &&
        (!rangeEnd || !isBefore(rangeEnd, end)),
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  let largestChange:
    | { previous: TimeSeriesDataPoint; current: TimeSeriesDataPoint; delta: number }
    | undefined;

  for (let index = 1; index < completed.length; index += 1) {
    const previous = completed[index - 1];
    const current = completed[index];
    if (!previous || !current || !areAdjacentBuckets(previous.start, current.start, groupBy)) {
      continue;
    }

    const delta = (current.item.expenses ?? 0) - (previous.item.expenses ?? 0);
    if (!largestChange || Math.abs(delta) > Math.abs(largestChange.delta)) {
      largestChange = { previous: previous.item, current: current.item, delta };
    }
  }

  return largestChange ?? null;
}
