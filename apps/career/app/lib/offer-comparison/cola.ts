import { getCity } from './cities';

export interface ColaResult {
  rent: number;
  transit: number;
  utilities: number;
  health: number;
  variableSpend: number;
  totalMonthly: number;
}

export function computeCola(
  homeCity: string,
  targetCity: string,
  homeVariableSpend: number,
): ColaResult {
  const home = getCity(homeCity);
  const target = getCity(targetCity);
  if (!home || !target) {
    throw new Error(`Unknown city slug: ${!home ? homeCity : targetCity}`);
  }

  const ratio = target.colaIndex / home.colaIndex;

  return {
    rent: target.rent,
    transit: target.transit,
    utilities: target.utilities,
    health: target.health,
    variableSpend: Math.round(homeVariableSpend * ratio),
    totalMonthly:
      target.rent +
      target.transit +
      target.utilities +
      target.health +
      Math.round(homeVariableSpend * ratio),
  };
}
