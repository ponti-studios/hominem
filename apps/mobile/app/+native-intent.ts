/**
 * +native-intent.ts
 *
 * Rewrites incoming deep links before Expo Router processes them.
 * Called for every incoming URL on native (iOS/Android).
 *
 * Supported deep link patterns:
 *   hakumi://verify?token=<otp>        -> /(auth)/verify?token=<otp>
 *   hakumi://chat/<id>                 -> /(protected)/(tabs)/chat/<id>
 *   hakumi://chat?seed=<text>          -> /(protected)/(tabs)/?seed=<text>
 *   hakumi://notes                     -> /(protected)/(tabs)
 *   hakumi://notes/<id>                -> /(protected)/(tabs)/notes/<id>
 *   hakumi://focus                     -> /(protected)/(tabs)/
 *   hakumi://focus/<id>                -> /(protected)/(tabs)/notes/<id>
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
    return '/(protected)/(tabs)';
  }

  // OTP verification link: verify?token=xxx -> /(auth)/verify?token=xxx
  if (normalized.startsWith('verify')) {
    return `/(auth)/${normalized}`;
  }

  // Chat with specific ID: chat/<id>
  const chatIdMatch = normalized.match(/^chat\/([^?]+)/);
  if (chatIdMatch) {
    return `/(protected)/(tabs)/chat/${chatIdMatch[1]}`;
  }

  // Chat with seed (start new): chat?seed=<text> -> feed with seed
  if (normalized.startsWith('chat')) {
    const seedParam = normalized.replace(/^chat\??/, '');
    return `/(protected)/(tabs)/${seedParam ? `?${seedParam}` : ''}`;
  }

  // Notes with specific ID
  const notesIdMatch = normalized.match(/^notes\/(.+)/);
  if (notesIdMatch) {
    return `/(protected)/(tabs)/notes/${notesIdMatch[1]}`;
  }

  // Notes list -> feed
  if (normalized === 'notes') {
    return '/(protected)/(tabs)';
  }

  // Focus with specific ID -> note detail
  const focusIdMatch = normalized.match(/^focus\/(.+)/);
  if (focusIdMatch) {
    return `/(protected)/(tabs)/notes/${focusIdMatch[1]}`;
  }

  // Focus list -> feed
  if (normalized === 'focus') {
    return '/(protected)/(tabs)/';
  }

  // Account/settings screen
  if (normalized.startsWith('account')) {
    return '/(protected)/(tabs)/settings';
  }

  return path;
}
