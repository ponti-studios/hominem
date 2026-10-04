const DAY_MS = 86_400_000;

/**
 * Two weeks of local calendar days with their weekday names, so the model reads
 * "Monday" off a list instead of counting from the reference date. Returns null
 * when the reference date or time zone cannot be interpreted.
 *
 * Keep services/api/src/application/upcoming-days.ts identical: the evals must send
 * the model the same line production does.
 */
export function describeUpcomingDays(
  referenceDate: string,
  timezone: string | undefined,
  days = 14,
): string | null {
  const instant = new Date(referenceDate);
  if (!timezone || Number.isNaN(instant.getTime())) return null;
  try {
    const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone: timezone })
      .format(instant)
      .split('-')
      .map(Number);
    if (!year || !month || !day) return null;
    const start = Date.UTC(year, month - 1, day);
    return Array.from({ length: days }, (_, offset) => {
      const date = new Date(start + offset * DAY_MS);
      const weekday = date.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long' });
      const note = offset === 0 ? ' (today)' : offset === 1 ? ' (tomorrow)' : '';
      return `${weekday} ${date.toISOString().slice(0, 10)}${note}`;
    }).join(', ');
  } catch {
    return null;
  }
}
