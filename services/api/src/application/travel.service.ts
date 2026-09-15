import { db } from '@hominem/db/core';

export async function listTripHistory(
  ownerUserId: string,
  input: { from?: string; to?: string; limit: number },
) {
  const trips = await db
    .selectFrom('app.travelTrips')
    .select(['id', 'city', 'state', 'country', 'startDate', 'endDate'])
    .where('ownerUserid', '=', ownerUserId)
    .$if(input.from !== undefined, (query) => query.where('startDate', '>=', input.from!))
    .$if(input.to !== undefined, (query) => query.where('startDate', '<=', input.to!))
    .orderBy('startDate', 'desc')
    .limit(input.limit)
    .execute();
  const withAttendees = await Promise.all(
    trips.map(async (trip) => {
      const attendees = await db
        .selectFrom('app.travelTripAttendees as attendee')
        .innerJoin('app.people as person', 'person.id', 'attendee.personId')
        .select('person.displayName as displayName')
        .where('attendee.tripId', '=', trip.id)
        .execute();
      return {
        ...trip,
        attendeeNames: attendees
          .map((attendee) => attendee.displayName)
          .filter((name): name is string => name !== null),
      };
    }),
  );
  return { trips: withAttendees, count: withAttendees.length };
}
