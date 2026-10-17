import { contains, loadTravelData, makePage } from './travel-analytics-data.service';

export async function travelSearch(owner: string, input: { query: string; limit: number }) {
  const data = await loadTravelData(owner);
  const results = {
    journeys: data.journeys
      .filter((row) => contains(row.name, input.query) || contains(row.notes, input.query))
      .sort((a, b) => a.id.localeCompare(b.id)),
    places: data.places
      .filter((row) => contains(row.place, input.query))
      .sort((a, b) => a.id.localeCompare(b.id)),
    stays: data.stays
      .filter(
        (row) =>
          contains(row.property, input.query) ||
          contains(row.city, input.query) ||
          contains(row.bookingRef, input.query),
      )
      .sort((a, b) => a.id.localeCompare(b.id)),
    transport: data.transport
      .filter((row) => contains(row.carrier, input.query) || contains(row.bookingRef, input.query))
      .sort((a, b) => a.id.localeCompare(b.id)),
    ideas: data.ideas
      .filter((row) => contains(row.idea, input.query))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
  const pages = {
    journeys: makePage(results.journeys, input.limit),
    places: makePage(results.places, input.limit),
    stays: makePage(results.stays, input.limit),
    transport: makePage(results.transport, input.limit),
    ideas: makePage(results.ideas, input.limit),
  };
  const total =
    results.journeys.length +
    results.places.length +
    results.stays.length +
    results.transport.length +
    results.ideas.length;
  return {
    query: input.query,
    total,
    truncated: Object.values(pages).some((page) => page.truncated),
    ...pages,
  };
}
