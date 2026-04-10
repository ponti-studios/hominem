import { durations, translateDistances } from '@hominem/ui/tokens';
import { Easing } from 'react-native-reanimated';

// Re-export canonical durations under the existing names so call sites need
// no changes. Numeric values are guaranteed to match the web animation system.
const VOID_MOTION_ENTER = durations.enter;
const VOID_MOTION_EXIT = durations.exit;
const VOID_MOTION_DURATION_STANDARD = durations.standard;

// CSS easing is web-only (see packages/ui/src/tokens/motion.ts easingWeb).
// Mobile easing uses react-native-reanimated Easing functions kept here.
const VOID_EASING_ENTER = Easing.out(Easing.cubic); // decelerate
const VOID_EASING_EXIT = Easing.in(Easing.cubic); // accelerate
const VOID_EASING_STANDARD = Easing.inOut(Easing.ease);

const VOID_ENTER_TRANSLATE_Y = translateDistances.enterY;
const VOID_EXIT_TRANSLATE_Y = translateDistances.exitY;

export {
  VOID_EASING_ENTER,
  VOID_EASING_EXIT,
  VOID_EASING_STANDARD,
  VOID_ENTER_TRANSLATE_Y,
  VOID_EXIT_TRANSLATE_Y,
  VOID_MOTION_DURATION_STANDARD,
  VOID_MOTION_ENTER,
  VOID_MOTION_EXIT,
};
