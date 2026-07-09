import type { InboxStreamItem } from '@hominem/rpc/types';

import { storage } from '~/services/storage/mmkv';

const INBOX_CACHE_KEY = 'inbox-stream-cache-v1';

interface CachedInboxSnapshot {
  items: InboxStreamItem[];
  savedAt: string;
}

function isInboxKind(value: unknown): value is InboxStreamItem['kind'] {
  return value === 'note' || value === 'chat';
}

function isInboxItem(value: unknown): value is InboxStreamItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === 'string' &&
    typeof item.entityId === 'string' &&
    isInboxKind(item.kind) &&
    typeof item.updatedAt === 'string' &&
    (item.title === null || typeof item.title === 'string') &&
    (item.preview === null || typeof item.preview === 'string')
  );
}

function sortInboxItems(items: InboxStreamItem[]) {
  return items.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function mergeInboxItems(items: InboxStreamItem[]) {
  const mergedItems = new Map<string, InboxStreamItem>();

  items.forEach((item) => {
    mergedItems.set(`${item.kind}:${item.id}`, item);
  });

  return sortInboxItems(Array.from(mergedItems.values()));
}

export interface CachedInboxSnapshotResult {
  items: InboxStreamItem[];
  savedAt: number | null;
}

export function readCachedInboxSnapshot(): CachedInboxSnapshotResult {
  const raw = storage.getString(INBOX_CACHE_KEY);
  if (!raw) {
    return { items: [], savedAt: null };
  }

  try {
    const parsed = JSON.parse(raw) as { items?: unknown; savedAt?: unknown };
    if (!Array.isArray(parsed.items)) {
      storage.remove(INBOX_CACHE_KEY);
      return { items: [], savedAt: null };
    }

    const items = sortInboxItems(parsed.items.filter(isInboxItem));
    const savedAt = typeof parsed.savedAt === 'string' ? Date.parse(parsed.savedAt) : Number.NaN;
    return { items, savedAt: Number.isFinite(savedAt) ? savedAt : null };
  } catch {
    storage.remove(INBOX_CACHE_KEY);
    return { items: [], savedAt: null };
  }
}

export function readCachedInboxItems(): InboxStreamItem[] {
  return readCachedInboxSnapshot().items;
}

function writeCachedInboxItems(items: InboxStreamItem[]) {
  const snapshot: CachedInboxSnapshot = {
    items,
    savedAt: new Date().toISOString(),
  };

  try {
    storage.set(INBOX_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Native MMKV object may be stale after a Fast Refresh cycle; safe to ignore.
  }
}

export function replaceCachedInboxItems(items: InboxStreamItem[]) {
  writeCachedInboxItems(sortInboxItems([...items]));
}

export function appendCachedInboxItems(items: InboxStreamItem[]) {
  writeCachedInboxItems(mergeInboxItems([...readCachedInboxItems(), ...items]));
}

export function removeCachedInboxItem(identity: {
  kind: InboxStreamItem['kind'];
  entityId: string;
}) {
  writeCachedInboxItems(
    readCachedInboxItems().filter(
      (item) => !(item.kind === identity.kind && item.entityId === identity.entityId),
    ),
  );
}
