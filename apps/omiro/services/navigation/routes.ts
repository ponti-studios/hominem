import type { RelativePathString } from 'expo-router';

export type ContentKind = 'chat' | 'note';

export interface ResumeTarget {
  kind: ContentKind;
  id: string;
  title: string | null;
  updatedAt: string | null;
}

export const INBOX_ROUTE = '/(protected)';
export const SETTINGS_ROUTE = '/(protected)/settings' as RelativePathString;
export const ARCHIVED_CHATS_ROUTE = '/(protected)/settings/archived-chats';
export const ON_DEVICE_CALENDAR_ROUTE = '/(protected)/settings/calendar';

export function getTaskDetailRoute(id: string) {
  return `/(protected)/tasks/${id}`;
}

export function getContentRoute(kind: ContentKind, id: string) {
  if (!id) {
    throw new Error('Content route requires an id');
  }

  return `/(protected)/inbox/${kind}/${id}`;
}
