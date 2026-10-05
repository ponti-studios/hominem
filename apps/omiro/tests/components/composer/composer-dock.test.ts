import { describe, expect, it } from 'vitest';

import {
  DOCK_KEYBOARD_GAP,
  getDockKeyboardOffset,
  getDockRestingInset,
  getFloatingDockInset,
} from '~/components/composer/composerDock.helpers';

describe('dock resting inset', () => {
  it('sits above the home indicator plus whatever else floats at the bottom', () => {
    expect(getDockRestingInset({ clearance: 8, safeAreaBottom: 34 })).toBe(42);
    expect(getDockRestingInset({ clearance: 58, safeAreaBottom: 34 })).toBe(92);
  });
});

describe('dock keyboard lift', () => {
  // KeyboardStickyView lifts the dock by (keyboardHeight - offset.opened).
  const bottomEdgeAboveScreen = (restingInset: number, keyboardHeight: number) =>
    restingInset + (keyboardHeight - getDockKeyboardOffset(restingInset));

  it('leaves the same gap above the keyboard whatever the resting inset', () => {
    for (const restingInset of [42, 92]) {
      expect(bottomEdgeAboveScreen(restingInset, 336)).toBe(336 + DOCK_KEYBOARD_GAP);
    }
  });
});

describe('floating composer inset', () => {
  it('reserves no extra space while the keyboard is hidden', () => {
    expect(getFloatingDockInset({ keyboardHeight: 0, restingInset: 42 })).toBe(0);
  });

  it('reserves exactly the overlap the lifted dock has with the content above it', () => {
    // Lifted dock bottom is 348 above the screen; at rest it is 42 above it.
    expect(getFloatingDockInset({ keyboardHeight: 336, restingInset: 42 })).toBe(306);
    expect(getFloatingDockInset({ keyboardHeight: 336, restingInset: 92 })).toBe(256);
  });

  it('does not reserve space when the keyboard is lower than the resting dock', () => {
    expect(getFloatingDockInset({ keyboardHeight: 20, restingInset: 92 })).toBe(0);
  });
});
