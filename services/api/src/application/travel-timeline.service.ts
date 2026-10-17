import {
  compareDate,
  daysBetween,
  labelHomeGap,
  loadTravelData,
  residenceBoundaries,
  shiftDate,
} from './travel-analytics-data.service';

export async function travelTimeline(
  owner: string,
  input: { from?: string; to?: string; limit?: number; offset?: number } = {},
) {
  const data = await loadTravelData(owner);
  const events: Record<string, unknown>[] = data.segments.map((segment) => ({
    type: 'segment',
    id: segment.id,
    entityId: segment.id,
    place: data.placeById.get(segment.placeId)?.place ?? null,
    country: data.placeById.get(segment.placeId)?.country ?? null,
    arrivalDate: segment.arrivalDate,
    departureDate: segment.departureDate,
    nights: daysBetween(segment.arrivalDate, segment.departureDate),
    journeyId: segment.journeyId,
    journeyRefId: data.journeyById.get(segment.journeyId)?.id ?? null,
    seq: segment.seq,
  }));
  const journeys = [...data.journeys]
    .filter((journey) => journey.startDate && journey.endDate)
    .sort((a, b) => compareDate(a.startDate, b.startDate));
  let active: (typeof journeys)[number] | undefined;
  for (const next of journeys) {
    if (!active) {
      active = next;
      continue;
    }
    if (!active.endDate || !next.startDate) continue;
    if (next.startDate <= active.endDate) {
      if (next.endDate && next.endDate > active.endDate) active = next;
      continue;
    }
    const previous = active;
    const start = previous.endDate!;
    const end = next.startDate!;
    const boundaries = residenceBoundaries(start, end, data.residences);
    let cursor = start;
    for (const boundary of [...boundaries, end]) {
      if (boundary <= cursor) continue;
      const sliceEnd = boundary === end ? end : shiftDate(boundary, -1);
      events.push({
        type: 'home_gap',
        startDate: cursor,
        endDate: sliceEnd,
        days: daysBetween(cursor, boundary),
        fromJourneyId: previous.id,
        toJourneyId: next.id,
        home: labelHomeGap(cursor, sliceEnd, data.residences),
      });
      cursor = boundary;
    }
    active = next;
  }
  const filtered = events
    .filter((event) => {
      const start = String(
        event.type === 'segment' ? (event.arrivalDate ?? '') : (event.startDate ?? ''),
      );
      const end = String(
        event.type === 'segment' ? (event.departureDate ?? '') : (event.endDate ?? ''),
      );
      return (
        (!input.from || (end !== '' && end >= input.from)) &&
        (!input.to || (start !== '' && start <= input.to))
      );
    })
    .sort((a, b) => {
      const startA = String(a.type === 'segment' ? (a.arrivalDate ?? '') : (a.startDate ?? ''));
      const startB = String(b.type === 'segment' ? (b.arrivalDate ?? '') : (b.startDate ?? ''));
      return (
        startA.localeCompare(startB) ||
        String(a.type).localeCompare(String(b.type)) ||
        String(a.id ?? a.fromJourneyId ?? '').localeCompare(String(b.id ?? b.fromJourneyId ?? ''))
      );
    });
  const limit = input.limit ?? 100;
  const offset = input.offset ?? 0;
  return {
    events: filtered.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset,
    truncated: offset + limit < filtered.length,
    from: input.from ?? null,
    to: input.to ?? null,
  };
}
