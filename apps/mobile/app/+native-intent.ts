/**
 * +native-intent.ts
 *
 * Rewrites incoming deep links before Expo Router processes them.
 * Called for every incoming URL on native (iOS/Android).
 *
 * Supported deep link patterns:
 *   hakumi://verify?token=<otp>        → /(auth)/verify?token=<otp>
 *   hakumi://chat?seed=<text>          → /(protected)/(tabs)/chat?seed=<text>
 *   hakumi://notes                     → /(protected)/(tabs)/notes
 *   hakumi://notes/<id>                → /(protected)/(tabs)/notes/<id>
 *   hakumi://focus                     → /(protected)/(tabs)/notes
 *   hakumi://focus/<id>                → /(protected)/(tabs)/notes/<id>
 *   hakumi://account                   → /(protected)/(tabs)/account
 *   hakumi://note/add                  → /(protected)/(tabs)/notes?action=new
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

  // App Intent / Siri: note/add → notes tab with new-note action
  if (normalized === 'note/add') {
    return '/(protected)/(tabs)/notes?action=new';
  }

  // OTP verification link: verify?token=xxx → /(auth)/verify?token=xxx
  if (normalized.startsWith('verify')) {
    return `/(auth)/${normalized}`;
  }

  // Chat intent
  if (normalized.startsWith('chat')) {
    return `/(protected)/(tabs)/${normalized}`;
  }

  if (normalized.startsWith('notes')) {
    return `/(protected)/(tabs)/${normalized}`;
  }

  if (normalized.startsWith('focus')) {
    return `/(protected)/(tabs)/${normalized.replace(/^focus/, 'notes')}`;
  }

  // Account screen
  if (normalized.startsWith('account')) {
    return `/(protected)/(tabs)/account`;
  }
  return path;
}
