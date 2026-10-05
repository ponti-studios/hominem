import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The native iOS 26 tab bar floats over the screen without adding to the
// safe-area insets, so anything docked to a tab screen's bottom edge adds this
// to the home-indicator inset to sit above it.
export const TAB_BAR_CLEARANCE = 58;

export function useTabBarInset() {
  return useSafeAreaInsets().bottom + TAB_BAR_CLEARANCE;
}
