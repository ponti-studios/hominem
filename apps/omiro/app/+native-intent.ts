import { getContentRoute, getInboxRoute, getSettingsRoute } from '~/services/navigation/routes';

/**
 * +native-intent.ts
 *
 * Rewrites incoming deep links before Expo Router processes them.
 * Called for every incoming URL on native (iOS/Android).
 *
 * Supported deep link patterns:
 *   hakumi://verify?token=<otp>        -> /(auth)/verify?token=<otp>
 *   hakumi://chat/<id>                 -> /(protected)/inbox/chat/<id>
 *   hakumi://chat?seed=<text>          -> /(protected)?seed=<text>
 *   hakumi://notes                     -> /(protected)
 *   hakumi://notes/<id>                -> /(protected)/inbox/note/<id>
 *   hakumi://focus                     -> /(protected)
 *   hakumi://focus/<id>                -> /(protected)/inbox/note/<id>
 *   hakumi://account                   -> /(protected)/settings
 *   hakumi://note/add                  -> /(protected)
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

  // App Intent / Siri: note/add -> inbox
  if (normalized === 'note/add') {
    return getInboxRoute();
  }

  // OTP verification link: verify?token=xxx -> /(auth)/verify?token=xxx
  if (normalized.startsWith('verify')) {
    return `/(auth)/${normalized}`;
  }

  // Chat with specific ID: chat/<id>
  const chatIdMatch = normalized.match(/^chat\/([^?]+)/);
  if (chatIdMatch) {
    return getContentRoute('chat', chatIdMatch[1]);
  }

  // Chat with seed (start new): chat?seed=<text> -> inbox with seed
  if (normalized.startsWith('chat')) {
    const seedParam = normalized.replace(/^chat\??/, '');
    const homeRoute = getInboxRoute();
    return `${homeRoute}${seedParam ? `?${seedParam}` : ''}`;
  }

  // Notes with specific ID
  const notesIdMatch = normalized.match(/^notes\/(.+)/);
  if (notesIdMatch) {
    return getContentRoute('note', notesIdMatch[1]);
  }

  // Notes list -> inbox
  if (normalized === 'notes') {
    return getInboxRoute();
  }

  // Focus with specific ID -> note detail
  const focusIdMatch = normalized.match(/^focus\/(.+)/);
  if (focusIdMatch) {
    return getContentRoute('note', focusIdMatch[1]);
  }

  // Focus list -> inbox
  if (normalized === 'focus') {
    return getInboxRoute();
  }

  // Account/settings screen
  if (normalized.startsWith('account')) {
    return getSettingsRoute();
  }

  return path;
}
