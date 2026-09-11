import { type ReactNode } from 'react';
import { View } from 'react-native';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getFloatingDockInset } from './composerDock.helpers';

interface ComposerDockProps {
  children: ReactNode;
  onHeightChange?: (height: number) => void;
  safeAreaBottom: number;
  testID?: string;
}

export function useComposerDockMetrics() {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardState((state) => state.height);
  return {
    inset: getFloatingDockInset({ keyboardHeight, safeAreaBottom: insets.bottom }),
    safeAreaBottom: insets.bottom,
  };
}

// The dock floats over whatever scrollable content sits behind it, so that
// content needs its own bottom inset equal to the dock's rendered height --
// `useComposerDockMetrics().inset` only covers the extra space the keyboard
// eats into beyond the safe area, not the dock itself. Callers should add
// this measured height on top of that inset, or the last row(s) of their
// list sit permanently half-hidden under the dock at rest.
export function ComposerDock({
  children,
  onHeightChange,
  safeAreaBottom,
  testID,
}: ComposerDockProps) {
  return (
    <KeyboardStickyView
      offset={{ closed: 0, opened: safeAreaBottom }}
      onLayout={
        onHeightChange
          ? (event) => {
              onHeightChange(event.nativeEvent.layout.height);
            }
          : undefined
      }
      style={{ paddingBottom: safeAreaBottom, paddingHorizontal: 8 }}
      testID={testID}
    >
      <View>{children}</View>
    </KeyboardStickyView>
  );
}
