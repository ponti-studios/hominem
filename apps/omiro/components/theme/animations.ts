import { Easing, FadeInUp, FadeOutDown, LinearTransition } from 'react-native-reanimated';

import { transitionDurations } from '~/components/theme';

export const VOID_MOTION_ENTER = transitionDurations[150];
export const VOID_MOTION_DURATION_STANDARD = transitionDurations[150];
export const VOID_EASING_ENTER = Easing.out(Easing.cubic);

export function createEnter(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeInUp.duration(transitionDurations[150]);
}

export function createExit(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeOutDown.duration(transitionDurations[100]);
}

export function createLayoutTransition(reducedMotion: boolean) {
  return reducedMotion ? undefined : LinearTransition.duration(transitionDurations[150]);
}
