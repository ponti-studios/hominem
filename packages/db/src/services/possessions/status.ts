// The canonical possession lifecycle (cross-platform merge, decision 8). Still's
// path wins: wishlist -> planned -> ordered -> delivered -> owned, with archiving
// as a boolean rather than a status. The Possessions end states collapse onto it.
//
// This table is the contract shared by every boundary — the Hominem API, Still's
// React Native mapping (`src/core/mapping.ts`), StillCore, and the Mac importer —
// and is written out in Still's `docs/status-category-mapping.md`. Keep the three
// copies in step; each has a test covering every legacy value.

export const CANONICAL_STATUSES = ['wishlist', 'planned', 'ordered', 'delivered', 'owned'] as const;
export type CanonicalStatus = (typeof CANONICAL_STATUSES)[number];

/** Possessions end states. They read as archived, with the reason kept. */
export const ARCHIVED_STATUSES = ['retired', 'disposed', 'donated', 'sold'] as const;
export type ArchivedReason = (typeof ARCHIVED_STATUSES)[number];

export type Canonicalized = {
  status: CanonicalStatus;
  isArchived: boolean;
  /** Set when the row is archived by its status rather than an explicit flag. */
  archivedReason?: ArchivedReason;
};

const CANONICAL: Record<string, CanonicalStatus> = {
  wishlist: 'wishlist',
  planned: 'planned',
  ordered: 'ordered',
  delivered: 'delivered',
  owned: 'owned',
  in_use: 'owned',
};

const ARCHIVED: Record<string, ArchivedReason> = {
  retired: 'retired',
  disposed: 'disposed',
  donated: 'donated',
  sold: 'sold',
};

/**
 * Maps any stored status onto the canonical lifecycle. An end state becomes
 * `owned` + archived, carrying its reason; an unknown value (an owner-invented
 * string) falls back to `owned` and never archives, so it cannot make a row
 * invisible.
 */
export function canonicalizeStatus(
  status: string | null | undefined,
  isArchived = false,
): Canonicalized {
  const key = status?.trim().toLowerCase() ?? '';
  const reason = ARCHIVED[key];
  if (reason) return { status: 'owned', isArchived: true, archivedReason: reason };
  const canonical = CANONICAL[key];
  return { status: canonical ?? 'owned', isArchived };
}
