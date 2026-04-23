import { Easing, FadeInUp, FadeOutDown, LinearTransition } from 'react-native-reanimated';

import { durations } from '~/components/theme';

export const VOID_MOTION_ENTER = durations.enter;
export const VOID_MOTION_DURATION_STANDARD = durations.standard;
export const VOID_EASING_ENTER = Easing.out(Easing.cubic);

// void-anim-enter: translateY(6px → 0) — rises from below
export function createEnter(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeInUp.duration(durations.enter);
}

// void-anim-exit: translateY(0 → 4px) — sinks below
export function createExit(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeOutDown.duration(durations.exit);
}

export function createLayoutTransition(reducedMotion: boolean) {
  return reducedMotion ? undefined : LinearTransition.duration(durations.enter);
}
