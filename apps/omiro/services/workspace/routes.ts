import type { RelativePathString } from 'expo-router';

export type WorkspaceArtifactKind = 'chat' | 'note';

export interface WorkspaceResumeArtifact {
  kind: WorkspaceArtifactKind;
  id: string;
  title: string | null;
  updatedAt: string | null;
}

export function getWorkspaceHomeRoute(): RelativePathString {
  return '/(protected)/(tabs)' as RelativePathString;
}

export function getWorkspaceSettingsRoute(): RelativePathString {
  return '/(protected)/(tabs)/settings' as RelativePathString;
}

export function getWorkspaceArchivedChatsRoute(): RelativePathString {
  return '/(protected)/(tabs)/settings/archived-chats' as RelativePathString;
}

export function getWorkspaceArtifactRoute(
  kind: WorkspaceArtifactKind,
  id: string,
  params?: Record<string, string>,
): RelativePathString {
  const route = `/(protected)/(tabs)/inbox/${kind}/${id}`;
  if (!params || Object.keys(params).length === 0) {
    return route as RelativePathString;
  }

  const searchParams = new URLSearchParams(params);
  return `${route}?${searchParams.toString()}` as RelativePathString;
}

export function getLegacyArtifactRoute(
  kind: WorkspaceArtifactKind,
  id: string,
): RelativePathString {
  return `/(protected)/(tabs)/${kind === 'note' ? 'notes' : kind}/${id}` as RelativePathString;
}
