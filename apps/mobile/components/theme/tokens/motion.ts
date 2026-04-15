/**
 * Motion tokens — durations and translate distances.
 *
 * Durations are in milliseconds. Must match animations.css and
 * packages/platform/ui/src/tokens/motion.ts.
 *
 * CSS easing strings are web-only. Mobile uses react-native-reanimated
 * Easing.* functions which cannot be expressed as strings.
 */

export const durations = {
  /** Element arrives and settles (decelerate). */
  enter: 150,
  /** Element leaves without lingering (accelerate). */
  exit: 120,
  /** Content animations: loading states, thinking indicators. */
  standard: 120,
  /** Loop / breezy animations. */
  breezy: 1800,
  spin: 1200,
} as const;

export const translateDistances = {
  /** Enter lift (px). */
  enterY: 6,
  /** Exit settle (px). */
  exitY: 4,
  enterX: 6,
  exitX: 4,
} as const;
