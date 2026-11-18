import { useEffect } from 'react';

import type { InboxStreamItemData } from '~/components/inbox/InboxStreamItem.types';
import { stripPreviewMarkdown } from '~/components/inbox/strip-preview-markdown';
import OmiroSystem, { type SpotlightItem, type SpotlightItemKind } from '~/modules/omiro-system';

// What this launch has already handed to Spotlight: identifier -> updatedAt.
// Spotlight keeps its own copy across launches; this only saves re-sending
// rows that have not changed since.
const indexed = new Map<string, string>();

const spotlightIdentifier = (kind: SpotlightItemKind, entityId: string) => `${kind}:${entityId}`;

// The rows worth a Spotlight entry that are new or changed since `known`.
// A row with neither a title nor a preview has nothing to search for.
export function getSpotlightUpdates(
  items: InboxStreamItemData[],
  known: ReadonlyMap<string, string>,
): SpotlightItem[] {
  return items.flatMap((item) => {
    const title = item.title?.trim();
    const preview = item.preview ? stripPreviewMarkdown(item.preview) : '';
    if (
      (!title && !preview) ||
      known.get(spotlightIdentifier(item.kind, item.entityId)) === item.updatedAt
    ) {
      return [];
    }
    return [
      {
        body: title ? preview : null,
        id: item.entityId,
        kind: item.kind,
        title: title || preview,
        updatedAt: item.updatedAt,
      },
    ];
  });
}

// Keeps the device's Spotlight index in step with the chats and notes on
// screen, so they can be found (and opened) from system search. The index
// lives on the device only.
export function useSpotlightIndex(items: InboxStreamItemData[]) {
  useEffect(() => {
    const updates = getSpotlightUpdates(items, indexed);
    if (updates.length === 0) {
      return;
    }
    for (const update of updates) {
      indexed.set(spotlightIdentifier(update.kind, update.id), update.updatedAt ?? '');
    }
    OmiroSystem.indexSpotlightItems(updates).catch(() => {
      // Not indexed after all: let the next change try again.
      for (const update of updates) {
        indexed.delete(spotlightIdentifier(update.kind, update.id));
      }
    });
  }, [items]);
}

// An archived chat or a deleted note must not stay findable.
export function removeFromSpotlight(kind: SpotlightItemKind, entityId: string) {
  const identifier = spotlightIdentifier(kind, entityId);
  indexed.delete(identifier);
  void OmiroSystem.removeSpotlightItems([identifier]).catch(() => undefined);
}

// Signing out takes the account's content out of system search.
export async function clearSpotlight() {
  indexed.clear();
  await OmiroSystem.clearSpotlight().catch(() => undefined);
}
