export type ContentKind = 'chat' | 'note';

export interface ResumeTarget {
  kind: ContentKind;
  id: string;
  title: string | null;
  updatedAt: string | null;
}

export const HOME_ROUTE = '/(protected)';
export const NEW_CHAT_ROUTE = '/(protected)/new-chat';
export const STREAM_ROUTE = '/(protected)/(tabs)/stream';
export const TIME_ROUTE = '/(protected)/(tabs)/time';
export const TASKS_ROUTE = '/(protected)/(tabs)/tasks';
export const SETTINGS_ROUTE = '/(protected)/settings';
export const ARCHIVED_CHATS_ROUTE = '/(protected)/chats/archived';

export type TimeBlockSource = 'task' | 'event';

export function getTimeBlockRoute(source: TimeBlockSource, id: string) {
  return `/(protected)/time/${source}/${encodeURIComponent(id)}`;
}

export function getContentRoute(kind: ContentKind, id: string) {
  if (!id) {
    throw new Error('Content route requires an id');
  }

  return kind === 'chat'
    ? `/(protected)/chats/${encodeURIComponent(id)}`
    : `/(protected)/notes/${encodeURIComponent(id)}`;
}
