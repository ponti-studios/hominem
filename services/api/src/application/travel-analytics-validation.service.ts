import {
  findOutOfOrderSegmentPairs,
  loadTravelData,
  lower,
  makePage,
  overlaps,
} from './travel-analytics-data.service';

export async function travelValidate(owner: string) {
  const data = await loadTravelData(owner);
  type Offender = { id: string; detail: string };
  const checks: Record<string, { count: number; offenders: Offender[] }> = {};
  const add = (name: string, offenders: Offender[], count = offenders.length) =>
    (checks[name] = { count, offenders });
  const ref = (row: { id: string }, detail: string): Offender => ({
    id: row.id,
    detail,
  });
  add(
    'orphan_segment',
    data.segments
      .filter((row) => !data.journeyById.has(row.journeyId))
      .map((row) => ref(row, `Journey ${row.journeyId} is missing.`)),
  );
  add(
    'orphan_stay',
    data.stays
      .filter(
        (row) =>
          row.evidence !== 'want' &&
          ((row.segmentId !== null && !data.segmentById.has(row.segmentId)) ||
            (row.journeyId !== null && !data.journeyById.has(row.journeyId))),
      )
      .map((row) => ref(row, 'Linked segment or journey is missing.')),
  );
  add(
    'orphan_leg',
    data.transport
      .filter(
        (row) =>
          !data.journeyById.has(row.journeyId) ||
          (row.depSegmentId !== null && !data.segmentById.has(row.depSegmentId)) ||
          (row.arrSegmentId !== null && !data.segmentById.has(row.arrSegmentId)),
      )
      .map((row) => ref(row, 'Linked journey or segment is missing.')),
  );
  add(
    'unknown_airport_code',
    data.transport
      .filter(
        (row) =>
          !data.airportByCode.has(row.origin.toUpperCase()) ||
          !data.airportByCode.has(row.destination.toUpperCase()),
      )
      .map((row) => ref(row, 'Origin or destination airport code is not registered.')),
  );
  add(
    'segment_place_missing',
    data.segments
      .filter((segment) => !data.placeById.has(segment.placeId))
      .map((segment) => ref(segment, `Place ${segment.placeId} is missing.`)),
  );
  add(
    'journey_date_inversion',
    data.journeys
      .filter(
        (journey) => journey.startDate && journey.endDate && journey.endDate < journey.startDate,
      )
      .map((journey) => ref(journey, 'Journey endDate is before startDate.')),
  );
  add(
    'segment_date_inversion',
    data.segments
      .filter(
        (segment) =>
          segment.arrivalDate &&
          segment.departureDate &&
          segment.departureDate < segment.arrivalDate,
      )
      .map((segment) => ref(segment, 'Segment departureDate is before arrivalDate.')),
  );
  add(
    'stay_date_inversion',
    data.stays
      .filter((stay) => stay.checkIn && stay.checkOut && stay.checkOut < stay.checkIn)
      .map((stay) => ref(stay, 'Stay checkOut is before checkIn.')),
  );
  const segmentsByJourney = new Map<string, typeof data.segments>();
  for (const segment of data.segments)
    segmentsByJourney.set(segment.journeyId, [
      ...(segmentsByJourney.get(segment.journeyId) ?? []),
      segment,
    ]);
  const sequenceOffenders: Offender[] = [];
  for (const rows of segmentsByJourney.values()) {
    const counts = new Map<number, number>();
    for (const row of rows) counts.set(row.seq, (counts.get(row.seq) ?? 0) + 1);
    for (const [seq, count] of counts) {
      if (count > 1) {
        for (const row of rows.filter((candidate) => candidate.seq === seq))
          sequenceOffenders.push(ref(row, `Sequence ${seq} is duplicated within its journey.`));
      }
    }
    const ordered = [...counts.keys()].filter((seq) => seq >= 1).sort((a, b) => a - b);
    if (ordered[0] !== undefined && ordered[0] > 1) {
      const first = rows.find((row) => row.seq === ordered[0])!;
      sequenceOffenders.push(ref(first, `Missing sequence range 1..${ordered[0] - 1}.`));
    }
    for (let index = 1; index < ordered.length; index++) {
      const previous = ordered[index - 1]!;
      const nextSeq = ordered[index]!;
      if (nextSeq > previous + 1) {
        const next = rows.find((row) => row.seq === nextSeq)!;
        sequenceOffenders.push(
          ref(next, `Missing sequence range ${previous + 1}..${nextSeq - 1}.`),
        );
      }
    }
    for (const row of rows.filter((candidate) => candidate.seq < 1))
      sequenceOffenders.push(ref(row, `Sequence ${row.seq} is below the valid range 1..n.`));
  }
  add('segment_seq_gap_or_dupe', sequenceOffenders);
  add(
    'stay_journey_mismatch',
    data.stays
      .filter((stay) => {
        const segment = stay.segmentId ? data.segmentById.get(stay.segmentId) : undefined;
        return Boolean(segment && stay.journeyId !== segment.journeyId);
      })
      .map((stay) => ref(stay, 'Stay journeyId differs from its segment journeyId.')),
  );
  add(
    'stay_partially_linked',
    data.stays
      .filter((stay) => (stay.segmentId === null) !== (stay.journeyId === null))
      .map((stay) => ref(stay, 'Exactly one of segmentId and journeyId is set.')),
  );
  add(
    'thin_evidence_stays',
    data.stays
      .filter((stay) => stay.evidence === 'thin')
      .map((stay) => ref(stay, 'Stay evidence is thin and needs review.')),
  );
  const journeyOverlapOffenders: Offender[] = [];
  let journeyOverlapCount = 0;
  for (let index = 0; index < data.journeys.length; index++) {
    const journey = data.journeys[index]!;
    for (const other of data.journeys.slice(index + 1)) {
      if (overlaps(journey.startDate, journey.endDate, other.startDate, other.endDate)) {
        journeyOverlapCount++;
        journeyOverlapOffenders.push(
          ref(journey, `Date range overlaps journey ${other.id}.`),
          ref(other, `Date range overlaps journey ${journey.id}.`),
        );
      }
    }
  }
  add('journey_overlap', journeyOverlapOffenders, journeyOverlapCount);
  const segmentOverlapOffenders: Offender[] = [];
  let segmentOverlapCount = 0;
  const outOfOrderPairs = new Set(
    findOutOfOrderSegmentPairs(data.segments).map(([earlier, later]) => `${earlier}\u001f${later}`),
  );
  for (let i = 0; i < data.segments.length; i++) {
    const segment = data.segments[i]!;
    for (const other of data.segments.slice(i + 1)) {
      const samePlace = segment.placeId === other.placeId;
      const earlier = segment.seq < other.seq ? segment : other;
      const later = segment.seq < other.seq ? other : segment;
      const sameJourneyOutOfOrder = outOfOrderPairs.has(`${earlier.id}\u001f${later.id}`);
      if (
        (samePlace &&
          overlaps(
            segment.arrivalDate,
            segment.departureDate,
            other.arrivalDate,
            other.departureDate,
          )) ||
        sameJourneyOutOfOrder
      ) {
        segmentOverlapCount++;
        segmentOverlapOffenders.push(
          ref(segment, `Overlaps or is out of date order with ${other.id}.`),
        );
        segmentOverlapOffenders.push(
          ref(other, `Overlaps or is out of date order with ${segment.id}.`),
        );
      }
    }
  }
  add('segment_overlap', segmentOverlapOffenders, segmentOverlapCount);
  const nearDuplicateLegOffenders: Offender[] = [];
  let nearDuplicateLegCount = 0;
  for (let index = 0; index < data.transport.length; index++) {
    const leg = data.transport[index]!;
    for (const other of data.transport.slice(index + 1)) {
      if (
        leg.date !== null &&
        leg.date === other.date &&
        leg.origin.toUpperCase() === other.origin.toUpperCase() &&
        leg.destination.toUpperCase() === other.destination.toUpperCase() &&
        (!leg.number || !other.number || lower(leg.number) === lower(other.number))
      ) {
        nearDuplicateLegCount++;
        nearDuplicateLegOffenders.push(
          ref(leg, `Matches leg ${other.id} by date, route, and flight number.`),
          ref(other, `Matches leg ${leg.id} by date, route, and flight number.`),
        );
      }
    }
  }
  add('near_duplicate_leg', nearDuplicateLegOffenders, nearDuplicateLegCount);
  const nearDuplicateJourneyOffenders: Offender[] = [];
  let nearDuplicateJourneyCount = 0;
  for (let index = 0; index < data.journeys.length; index++) {
    const journey = data.journeys[index]!;
    const first = [...(segmentsByJourney.get(journey.id) ?? [])].sort((a, b) => a.seq - b.seq)[0];
    if (!first) continue;
    for (const other of data.journeys.slice(index + 1)) {
      const otherFirst = [...(segmentsByJourney.get(other.id) ?? [])].sort(
        (a, b) => a.seq - b.seq,
      )[0];
      if (
        journey.startDate !== null &&
        journey.startDate === other.startDate &&
        first.placeId === otherFirst?.placeId
      ) {
        nearDuplicateJourneyCount++;
        nearDuplicateJourneyOffenders.push(
          ref(journey, `Shares start date and first place with ${other.id}.`),
          ref(other, `Shares start date and first place with ${journey.id}.`),
        );
      }
    }
  }
  add('near_duplicate_journey', nearDuplicateJourneyOffenders, nearDuplicateJourneyCount);
  for (const check of Object.values(checks))
    check.offenders.sort((a, b) => a.id.localeCompare(b.id));
  return { checks };
}

export async function travelUnresolved(owner: string) {
  const [data, validation] = await Promise.all([loadTravelData(owner), travelValidate(owner)]);
  const stays = data.stays
    .filter((stay) => stay.evidence === 'thin')
    .sort((a, b) => a.id.localeCompare(b.id));
  const ideas = data.ideas
    .filter((idea) => idea.type === 'admin' && idea.status === 'open')
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    stays: makePage(stays, 100),
    ideas: makePage(ideas, 100),
    validation: Object.fromEntries(
      Object.entries(validation.checks).map(([name, value]) => [name, value.count]),
    ),
  };
}
