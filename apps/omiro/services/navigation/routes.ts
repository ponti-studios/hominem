import type { RelativePathString } from 'expo-router';

export type ContentKind = 'chat' | 'note';

export interface ResumeTarget {
  kind: ContentKind;
  id: string;
  title: string | null;
  updatedAt: string | null;
}

export function getInboxRoute(): RelativePathString {
  return '/(protected)' as RelativePathString;
}

export function getSettingsRoute(): RelativePathString {
  return '/(protected)/settings' as RelativePathString;
}

export function getArchivedChatsRoute(): RelativePathString {
  return '/(protected)/settings/archived-chats' as RelativePathString;
}

export function getTasksRoute(): RelativePathString {
  return '/(protected)/tasks' as RelativePathString;
}

export function getTaskDetailRoute(id: string): RelativePathString {
  return `/(protected)/tasks/${id}` as RelativePathString;
}

export function getContentRoute(
  kind: ContentKind,
  id: string,
  params?: Record<string, string>,
): RelativePathString {
  const route = `/(protected)/inbox/${kind}/${id}`;
  if (!params || Object.keys(params).length === 0) {
    return route as RelativePathString;
  }

  const searchParams = new URLSearchParams(params);
  return `${route}?${searchParams.toString()}` as RelativePathString;
}
