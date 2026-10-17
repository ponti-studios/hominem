import {
  compareDate,
  dayCount,
  daysBetween,
  loadTravelData,
  makePage,
} from './travel-analytics-data.service';
import { travelTimeline } from './travel-timeline.service';

export async function travelStats(owner: string, input: { year?: number } = {}) {
  const data = await loadTravelData(owner);
  const year = input.year === undefined ? undefined : String(input.year);
  const journeys = data.journeys.filter((journey) => !year || journey.startDate?.startsWith(year));
  const journeyIds = new Set(journeys.map((journey) => journey.id));
  const segments = data.segments.filter((segment) => journeyIds.has(segment.journeyId));
  const placesById = new Map<string, { id: string; place: string; country: string | null }>();
  for (const segment of segments) {
    const place = data.placeById.get(segment.placeId);
    if (place) placesById.set(place.id, place);
  }
  const countries = [...new Set([...placesById.values()].map((place) => place.country))].sort();
  const transport = data.transport.filter((leg) => journeyIds.has(leg.journeyId));
  const legCountByMode = Object.fromEntries(
    [...new Set(transport.map((leg) => leg.mode))]
      .sort()
      .map((mode) => [mode, transport.filter((leg) => leg.mode === mode).length]),
  );
  const totalDistanceKm = transport.reduce((sum, leg) => sum + (leg.distanceKm ?? 0), 0);
  const longestLeg =
    [...transport]
      .filter((leg) => leg.distanceKm !== null)
      .sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0) || a.id.localeCompare(b.id))[0] ??
    null;
  const distanceByJourney = new Map<string, number>();
  for (const leg of transport)
    if (leg.distanceKm !== null)
      distanceByJourney.set(
        leg.journeyId,
        (distanceByJourney.get(leg.journeyId) ?? 0) + leg.distanceKm,
      );
  const longestJourney =
    journeys
      .map((journey) => ({ journey, distanceKm: distanceByJourney.get(journey.id) ?? 0 }))
      .sort((a, b) => b.distanceKm - a.distanceKm || a.journey.id.localeCompare(b.journey.id))[0] ??
    null;
  const allTrips = [...journeys]
    .filter((journey) => journey.startDate)
    .sort((a, b) => compareDate(a.startDate, b.startDate));
  const firstTrip = allTrips[0];
  const latestTrip = allTrips.at(-1);
  const countsByYear = Object.fromEntries(
    [
      ...new Set(
        data.journeys.flatMap((journey) =>
          journey.startDate ? [journey.startDate.slice(0, 4)] : [],
        ),
      ),
    ]
      .sort()
      .map((value) => [
        value,
        data.journeys.filter((journey) => journey.startDate?.startsWith(value)).length,
      ]),
  );
  return {
    journeyCount: journeys.length,
    segmentCount: segments.length,
    placeCount: placesById.size,
    countryCount: countries.length,
    countryMethod: 'Derived from the countries of places referenced by journey segments.',
    legCountByMode,
    totalDistanceKm,
    distanceLabel:
      'Recorded transport legs only; this is a floor because many journeys have no recorded legs.',
    longestLeg: longestLeg
      ? {
          entityId: longestLeg.id,
          originCode: longestLeg.originCode,
          destinationCode: longestLeg.destinationCode,
          originPlace: longestLeg.originPlace,
          destinationPlace: longestLeg.destinationPlace,
          distanceKm: longestLeg.distanceKm,
          date: longestLeg.date,
          journeyRefId: data.journeyById.get(longestLeg.journeyId)?.id ?? null,
        }
      : null,
    longestJourneyByDistance: longestJourney
      ? {
          entityId: longestJourney.journey.id,
          name: longestJourney.journey.name,
          distanceKm: longestJourney.distanceKm,
        }
      : null,
    countsByYear,
    firstTrip: firstTrip
      ? {
          entityId: firstTrip.id,
          startDate: firstTrip.startDate,
          endDate: firstTrip.endDate,
        }
      : null,
    latestTrip: latestTrip
      ? {
          entityId: latestTrip.id,
          startDate: latestTrip.startDate,
          endDate: latestTrip.endDate,
        }
      : null,
  };
}

export async function travelInsights(owner: string, input: { year?: number } = {}) {
  const data = await loadTravelData(owner);
  const year = input.year === undefined ? undefined : String(input.year);
  const segments = data.segments.filter(
    (segment) => !year || segment.arrivalDate?.startsWith(year),
  );
  const placeStats = new Map<
    string,
    { place: string; country: string | null; segmentCount: number; days: number; nights: number }
  >();
  const countryStats = new Map<string, { country: string; days: number; nights: number }>();
  const yearStats = new Map<string, number>();
  for (const segment of segments) {
    const place = data.placeById.get(segment.placeId);
    if (!place) continue;
    const nights = daysBetween(segment.arrivalDate, segment.departureDate) ?? 0;
    const days = dayCount(segment.arrivalDate, segment.departureDate) ?? 0;
    const placeStat = placeStats.get(place.id) ?? {
      place: place.place,
      country: place.country,
      segmentCount: 0,
      days: 0,
      nights: 0,
    };
    placeStat.segmentCount++;
    placeStat.days += days;
    placeStat.nights += nights;
    placeStats.set(place.id, placeStat);
    if (place.country) {
      const countryStat = countryStats.get(place.country) ?? {
        country: place.country,
        days: 0,
        nights: 0,
      };
      countryStat.days += days;
      countryStat.nights += nights;
      countryStats.set(place.country, countryStat);
    }
    if (segment.arrivalDate)
      yearStats.set(
        segment.arrivalDate.slice(0, 4),
        (yearStats.get(segment.arrivalDate.slice(0, 4)) ?? 0) + days,
      );
  }
  const dayRows = [...placeStats.values()].sort(
    (a, b) => b.days - a.days || a.place.localeCompare(b.place),
  );
  const nightRows = [...placeStats.values()].sort(
    (a, b) => b.nights - a.nights || a.place.localeCompare(b.place),
  );
  const transport = data.transport.filter((leg) => !year || leg.date?.startsWith(year));
  const frequentRoutesMap = new Map<
    string,
    {
      originCode: string;
      destinationCode: string;
      originPlace: string | null;
      destinationPlace: string | null;
      count: number;
    }
  >();
  for (const leg of transport) {
    const key = `${leg.origin.toUpperCase()}-${leg.destination.toUpperCase()}`;
    const row = frequentRoutesMap.get(key) ?? {
      originCode: leg.origin,
      destinationCode: leg.destination,
      originPlace: leg.originPlace,
      destinationPlace: leg.destinationPlace,
      count: 0,
    };
    row.count++;
    frequentRoutesMap.set(key, row);
  }
  const byCarrier = new Map<string, number>();
  for (const leg of transport)
    if (leg.carrier) byCarrier.set(leg.carrier, (byCarrier.get(leg.carrier) ?? 0) + 1);
  const currentHome = data.residences.find((residence) =>
    residence.periods.some((period) => period.ongoing),
  );
  const homeRows = data.residences.map((residence) => ({
    entityId: residence.id,
    placeId: residence.placeId,
    place: residence.place,
    periods: residence.periods,
    totalRecordedDays: residence.periods.every((period) => period.endDate || period.ongoing)
      ? residence.periods.reduce(
          (sum, period) =>
            sum +
            (dayCount(
              period.startDate,
              period.endDate ?? (period.ongoing ? new Date().toISOString().slice(0, 10) : null),
            ) ?? 0),
          0,
        )
      : null,
    precisionCaveat: residence.periods.some(
      (period) => period.precision !== 'day' || !period.endDate,
    )
      ? 'A period has month/year precision or an unrecorded end; totals omit its unknown duration and must not be read as exact lived days.'
      : null,
  }));
  const future = data.journeys
    .filter(
      (journey) => journey.startDate && journey.startDate >= new Date().toISOString().slice(0, 10),
    )
    .sort((a, b) => compareDate(a.startDate, b.startDate))[0];
  const timeline = await travelTimeline(owner, {});
  const homeGaps = timeline.events.filter((event) => event.type === 'home_gap');
  const longestHomeGap =
    [...homeGaps].sort(
      (a, b) =>
        Number(b.days) - Number(a.days) || String(a.startDate).localeCompare(String(b.startDate)),
    )[0] ?? null;
  const topN = 20;
  const nextTrip = future
    ? {
        entityId: future.id,
        name: future.name,
        startDate: future.startDate,
        daysUntilStart: daysBetween(new Date().toISOString().slice(0, 10), future.startDate),
      }
    : null;
  return {
    daysPerPlace: makePage(dayRows, topN),
    nightsPerPlace: makePage(nightRows, topN),
    daysPerCountry: makePage(
      [...countryStats.values()].sort(
        (a, b) => b.days - a.days || a.country.localeCompare(b.country),
      ),
      topN,
    ),
    mostVisitedPlaces: makePage(
      [...placeStats.values()].sort(
        (a, b) =>
          b.segmentCount - a.segmentCount || b.days - a.days || a.place.localeCompare(b.place),
      ),
      topN,
    ),
    frequentRoutes: makePage(
      [...frequentRoutesMap.values()].sort(
        (a, b) =>
          b.count - a.count ||
          a.originCode.localeCompare(b.originCode) ||
          a.destinationCode.localeCompare(b.destinationCode),
      ),
      topN,
    ),
    legsByCarrier: makePage(
      [...byCarrier]
        .map(([carrier, count]) => ({ carrier, count }))
        .sort((a, b) => b.count - a.count || a.carrier.localeCompare(b.carrier)),
      topN,
    ),
    travelDaysPerYear: makePage(
      [...yearStats]
        .map(([year, days]) => ({ year, days }))
        .sort((a, b) => a.year.localeCompare(b.year)),
      topN,
    ),
    longestStay:
      [...segments]
        .map((segment) => ({
          ...segment,
          place: data.placeById.get(segment.placeId)?.place ?? null,
          nights: daysBetween(segment.arrivalDate, segment.departureDate),
        }))
        .sort((a, b) => (b.nights ?? -1) - (a.nights ?? -1) || a.id.localeCompare(b.id))[0] ?? null,
    longestHomeGap,
    nextTrip,
    homes: {
      residences: homeRows,
      currentHome: currentHome
        ? {
            place: currentHome.place,
            entityId: currentHome.id,
            period: currentHome.periods.find((period) => period.ongoing),
          }
        : null,
    },
  };
}
