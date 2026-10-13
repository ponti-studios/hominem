import type { ContainerRecord } from '@hominem/db/possessions';

export const normalizeVesselToken = (value: string): string => value.trim().toLowerCase();

export interface VesselLookup {
  byName: Map<string, ContainerRecord>;
  byToken: Map<string, ContainerRecord>;
  resolve: (token: string | null) => ContainerRecord | null;
}

// A vessel is a container. An item's token resolves to it either through the container's
// declared membership (`vesselTokens`, the weights tab's formulas) or, failing that, when
// the token is the container's own name. Marker tokens (travel/disposal annotations) and
// group allowances are owner config, not code — see VesselConfigRepository.
export function buildVesselLookup(containers: ContainerRecord[]): VesselLookup {
  const byName = new Map<string, ContainerRecord>();
  const byToken = new Map<string, ContainerRecord>();
  for (const container of containers) {
    const name = normalizeVesselToken(container.name);
    if (name && !byName.has(name)) byName.set(name, container);
    for (const token of container.vesselTokens ?? []) {
      const key = normalizeVesselToken(token);
      if (key && !byToken.has(key)) byToken.set(key, container);
    }
  }
  const resolve = (token: string | null): ContainerRecord | null => {
    if (!token) return null;
    const key = normalizeVesselToken(token);
    return byToken.get(key) ?? byName.get(key) ?? null;
  };
  return { byName, byToken, resolve };
}
