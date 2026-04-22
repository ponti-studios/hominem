import { durations, translateDistances } from '~/components/theme/tokens';
import {
  Easing,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  FadeOutDown,
  FadeOutLeft,
  FadeOutRight,
  FadeOutUp,
  LinearTransition,
} from 'react-native-reanimated';

export const VOID_MOTION_ENTER = durations.enter;
export const VOID_MOTION_EXIT = durations.exit;
export const VOID_MOTION_DURATION_STANDARD = durations.standard;
export const VOID_EASING_ENTER = Easing.out(Easing.cubic);
export const VOID_EASING_EXIT = Easing.in(Easing.cubic);
export const VOID_EASING_STANDARD = Easing.inOut(Easing.ease);
export const VOID_ENTER_TRANSLATE_Y = translateDistances.enterY;
export const VOID_EXIT_TRANSLATE_Y = translateDistances.exitY;

// void-anim-enter: translateY(6px → 0) — rises from below
export function createEnter(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeInUp.duration(durations.enter);
}

// void-anim-exit: translateY(0 → 4px) — sinks below
export function createExit(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeOutDown.duration(durations.exit);
}

// void-anim-enter-top: translateY(-6px → 0) — drops from above
export function createEnterTop(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeInDown.duration(durations.enter);
}

// void-anim-exit-top: translateY(0 → -4px) — rises out above
export function createExitTop(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeOutUp.duration(durations.exit);
}

// void-anim-enter-bottom: translateY(6px → 0) — same as enter
export function createEnterBottom(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeInUp.duration(durations.enter);
}

// void-anim-exit-bottom: translateY(0 → 6px) — sinks below
export function createExitBottom(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeOutDown.duration(durations.exit);
}

// void-anim-enter-left: translateX(-6px → 0) — slides in from left
export function createEnterLeft(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeInLeft.duration(durations.enter);
}

// void-anim-exit-left: translateX(0 → -4px) — slides out to left
export function createExitLeft(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeOutLeft.duration(durations.exit);
}

// void-anim-enter-right: translateX(6px → 0) — slides in from right
export function createEnterRight(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeInRight.duration(durations.enter);
}

// void-anim-exit-right: translateX(0 → 4px) — slides out to right
export function createExitRight(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeOutRight.duration(durations.exit);
}

export function createLayoutTransition(reducedMotion: boolean) {
  return reducedMotion ? undefined : LinearTransition.duration(durations.enter);
}
