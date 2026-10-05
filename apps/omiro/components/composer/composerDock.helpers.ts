// How far the dock hovers above the keyboard when it is open.
export const DOCK_KEYBOARD_GAP = 12;

// Where the dock's bottom edge rests when the keyboard is closed: above the
// home indicator, plus whatever else floats over the screen's bottom edge
// (the native tab bar passes its clearance; a pushed screen passes a small
// breathing gap).
export function getDockRestingInset({
  clearance,
  safeAreaBottom,
}: {
  clearance: number;
  safeAreaBottom: number;
}) {
  return safeAreaBottom + clearance;
}

// KeyboardStickyView lifts the dock by `keyboardHeight - offset.opened`. The
// dock already sits `restingInset` above the screen bottom, so lifting by
// `keyboardHeight - (restingInset - GAP)` leaves its bottom edge exactly GAP
// above the keyboard's top edge -- never under it, never far above it.
export function getDockKeyboardOffset(restingInset: number) {
  return restingInset - DOCK_KEYBOARD_GAP;
}

// How far the lifted dock overlaps the scrollable content behind it. At rest
// the dock is in flow and overlaps nothing; once the keyboard is open it
// rides up over the list, so the list needs this much extra bottom inset.
export function getFloatingDockInset({
  keyboardHeight,
  restingInset,
}: {
  keyboardHeight: number;
  restingInset: number;
}) {
  return Math.max(0, keyboardHeight - getDockKeyboardOffset(restingInset));
}
