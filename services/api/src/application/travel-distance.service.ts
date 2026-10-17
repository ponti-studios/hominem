import { ValidationError } from '@hominem/db/errors';

import { getTravelAirport } from './airport-catalogue.service';
import { haversineKm } from './travel-analytics-data.service';

export async function travelDistance(
  owner: string,
  input: { origin: string; destination: string },
) {
  const [origin, destination] = await Promise.all([
    getTravelAirport(owner, input.origin),
    getTravelAirport(owner, input.destination),
  ]);
  if (!origin || !destination) throw new ValidationError('unknown_airport');
  return {
    origin,
    destination,
    distanceKm: haversineKm(origin, destination),
  };
}
