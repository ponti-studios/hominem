import type { InboxStreamItemData } from './InboxStreamItem.types';
import { stripPreviewMarkdown } from './strip-preview-markdown';

// Ids in the leading contiguous run of unseen items. A new capture lands at
// the top, so only that run slides in -- pagination appends below already-
// seen items (never in the run) and filter switches replay only seen ids, so
// both mount static.
export function getEnteringItemIds(
  items: InboxStreamItemData[],
  seenIds: ReadonlySet<string>,
): Set<string> {
  const entering = new Set<string>();
  for (const item of items) {
    if (seenIds.has(item.id)) {
      break;
    }
    entering.add(item.id);
  }
  return entering;
}

// The rows whose title or preview contains every word of the search, in any
// order and any case. An empty search keeps every row.
export function filterStreamItems(
  items: InboxStreamItemData[],
  query: string,
): InboxStreamItemData[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return items;
  }
  return items.filter((item) => {
    const text =
      `${item.title ?? ''} ${item.preview ? stripPreviewMarkdown(item.preview) : ''}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
