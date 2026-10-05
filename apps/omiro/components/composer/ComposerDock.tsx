import { type ReactNode } from 'react';
import { View } from 'react-native';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getDockKeyboardOffset,
  getDockRestingInset,
  getFloatingDockInset,
} from './composerDock.helpers';

// Gap between a pushed screen's home indicator and the floating composer.
const DEFAULT_CLEARANCE = 8;

interface ComposerDockProps {
  children: ReactNode;
  // From useComposerDockMetrics: the distance from the screen's bottom edge
  // to the composer's bottom edge while the keyboard is closed.
  restingInset: number;
  testID?: string;
}

// `clearance` is the extra space under the composer beyond the home
// indicator: tab screens pass their tab bar's clearance, pushed screens keep
// the default.
export function useComposerDockMetrics({ clearance = DEFAULT_CLEARANCE } = {}) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardState((state) => state.height);
  const restingInset = getDockRestingInset({ clearance, safeAreaBottom: insets.bottom });
  return {
    inset: getFloatingDockInset({ keyboardHeight, restingInset }),
    restingInset,
  };
}

// The composer floats: it keeps its own margin from the screen edges and
// rides above the keyboard (see getDockKeyboardOffset) instead of resizing
// the screen. It sits in flow at the bottom of its screen, so at rest the
// content above it is already bounded; callers add `inset` from
// useComposerDockMetrics for the keyboard-lifted overlap only.
export function ComposerDock({ children, restingInset, testID }: ComposerDockProps) {
  return (
    <KeyboardStickyView
      offset={{ closed: 0, opened: getDockKeyboardOffset(restingInset) }}
      testID={testID}
    >
      <View style={{ paddingBottom: restingInset, paddingHorizontal: 12 }}>{children}</View>
    </KeyboardStickyView>
  );
}
