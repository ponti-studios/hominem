import {
  getWorkspaceArtifactRoute,
  getWorkspaceHomeRoute,
  getWorkspaceSettingsRoute,
} from '~/services/workspace/routes';

/**
 * +native-intent.ts
 *
 * Rewrites incoming deep links before Expo Router processes them.
 * Called for every incoming URL on native (iOS/Android).
 *
 * Supported deep link patterns:
 *   hakumi://verify?token=<otp>        -> /(auth)/verify?token=<otp>
 *   hakumi://chat/<id>                 -> /(protected)/(tabs)/inbox/chat/<id>
 *   hakumi://chat?seed=<text>          -> /(protected)/(tabs)/?seed=<text>
 *   hakumi://notes                     -> /(protected)/(tabs)
 *   hakumi://notes/<id>                -> /(protected)/(tabs)/inbox/note/<id>
 *   hakumi://focus                     -> /(protected)/(tabs)/
 *   hakumi://focus/<id>                -> /(protected)/(tabs)/inbox/note/<id>
 *   hakumi://account                   -> /(protected)/(tabs)/settings
 *   hakumi://note/add                  -> /(protected)/(tabs)
 */
export function redirectSystemPath({
  path,
  initial: _initial,
}: {
  path: string;
  initial: boolean;
}): string {
  // Strip leading slash for matching
  const normalized = path.startsWith('/') ? path.slice(1) : path;

  // App Intent / Siri: note/add -> feed
  if (normalized === 'note/add') {
    return getWorkspaceHomeRoute();
  }

  // OTP verification link: verify?token=xxx -> /(auth)/verify?token=xxx
  if (normalized.startsWith('verify')) {
    return `/(auth)/${normalized}`;
  }

  // Chat with specific ID: chat/<id>
  const chatIdMatch = normalized.match(/^chat\/([^?]+)/);
  if (chatIdMatch) {
    return getWorkspaceArtifactRoute('chat', chatIdMatch[1]);
  }

  // Chat with seed (start new): chat?seed=<text> -> feed with seed
  if (normalized.startsWith('chat')) {
    const seedParam = normalized.replace(/^chat\??/, '');
    const homeRoute = getWorkspaceHomeRoute();
    return `${homeRoute}${seedParam ? `?${seedParam}` : ''}`;
  }

  // Notes with specific ID
  const notesIdMatch = normalized.match(/^notes\/(.+)/);
  if (notesIdMatch) {
    return getWorkspaceArtifactRoute('note', notesIdMatch[1]);
  }

  // Notes list -> feed
  if (normalized === 'notes') {
    return getWorkspaceHomeRoute();
  }

  // Focus with specific ID -> note detail
  const focusIdMatch = normalized.match(/^focus\/(.+)/);
  if (focusIdMatch) {
    return getWorkspaceArtifactRoute('note', focusIdMatch[1]);
  }

  // Focus list -> feed
  if (normalized === 'focus') {
    return getWorkspaceHomeRoute();
  }

  // Account/settings screen
  if (normalized.startsWith('account')) {
    return getWorkspaceSettingsRoute();
  }

  return path;
}
