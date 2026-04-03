export const MOBILE_WORKSPACE_CONTEXTS = ['inbox', 'note', 'chat', 'search', 'settings'] as const;

export const MOBILE_WORKSPACE_BASE_CONTEXTS = ['inbox', 'search', 'settings'] as const;

export type MobileWorkspaceContext = (typeof MOBILE_WORKSPACE_CONTEXTS)[number];

export const MOBILE_WORKSPACE_LABELS: Record<MobileWorkspaceContext, string> = {
  inbox: 'Notes',
  note: 'Note',
  chat: 'Chat',
  search: 'Search',
  settings: 'Settings',
};

export const MOBILE_WORKSPACE_ROUTES: Record<MobileWorkspaceContext, Href | null> = {
  inbox: '/(protected)/(tabs)/',
  note: null,
  chat: null,
  search: null,
  settings: '/(protected)/(tabs)/settings',
};

export function resolveVisibleWorkspaceContexts(
  activeContext: MobileWorkspaceContext,
): MobileWorkspaceContext[] {
  if (activeContext === 'note') {
    return ['inbox', 'note', 'search', 'settings'];
  }

  if (activeContext === 'chat') {
    return ['inbox', 'chat', 'search', 'settings'];
  }

  return [...MOBILE_WORKSPACE_BASE_CONTEXTS];
}
import type { Href } from 'expo-router';
