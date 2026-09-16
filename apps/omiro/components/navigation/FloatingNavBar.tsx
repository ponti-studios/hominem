import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, withAlpha } from '~/components/theme';

export const FLOATING_NAV_BAR_HEIGHT = 44;
const FLOATING_NAV_BAR_MARGIN = 8;

// Space the floating bar occupies from the top of the screen -- callers use
// this to reserve room at the head of scrolling content so the first row
// starts just below the pill instead of directly underneath it.
export function useFloatingNavBarMetrics() {
  const insets = useSafeAreaInsets();
  const top = insets.top + FLOATING_NAV_BAR_MARGIN;
  return {
    top,
    contentInset: top + FLOATING_NAV_BAR_HEIGHT + FLOATING_NAV_BAR_MARGIN,
  };
}

interface FloatingNavBarProps {
  center: ReactNode;
  menu: ReactNode;
}

// A pill that floats over scrolling content (used with `headerTransparent`)
// instead of a fixed header row -- content scrolls underneath it. No
// expo-blur here: the mobile design system disallows real blur
// (oxlint.config.mjs, see BlurCard.tsx), so this is the same flat
// translucent-card treatment BlurCard uses.
export function FloatingNavBar({ center, menu }: FloatingNavBarProps) {
  const theme = useAppTheme();
  const { top } = useFloatingNavBarMetrics();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top }]}>
      <View
        style={[
          styles.pill,
          {
            backgroundColor: theme.colors.card,
            borderColor: withAlpha(theme.colors.border, 0.5),
            boxShadow: theme.shadows.md,
          },
        ]}
      >
        <View style={styles.center}>{center}</View>
        {menu}
      </View>
    </View>
  );
}

interface FloatingNavBarContent {
  center: ReactNode;
  menu: ReactNode;
}

interface FloatingNavBarContextValue {
  content: FloatingNavBarContent | null;
  setContent: (content: FloatingNavBarContent | null) => void;
}

const FloatingNavBarContext = createContext<FloatingNavBarContextValue | null>(null);

// Wraps the Stack navigator so Stream and Time can render into one shared
// FloatingNavBar instance mounted above the Stack, instead of each screen
// mounting (and remounting on navigation) its own pill.
export function FloatingNavBarProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<FloatingNavBarContent | null>(null);
  const value = useMemo(() => ({ content, setContent }), [content]);
  return <FloatingNavBarContext.Provider value={value}>{children}</FloatingNavBarContext.Provider>;
}

// Screens call this to publish what the shared FloatingNavBar should show
// while they're focused. Content is cleared only on unmount (not on every
// content change) so switching between screens that both use it never
// flashes an empty pill in between.
export function useFloatingNavBarContent(content: FloatingNavBarContent) {
  const ctx = useContext(FloatingNavBarContext);
  if (!ctx) {
    throw new Error('useFloatingNavBarContent must be used within a FloatingNavBarProvider');
  }
  const { setContent } = ctx;
  useEffect(() => {
    setContent(content);
  }, [content, setContent]);
  useEffect(() => () => setContent(null), [setContent]);
}

// The single FloatingNavBar instance, rendered once above the Stack. Renders
// nothing when no focused screen has published content.
export function SharedFloatingNavBar() {
  const ctx = useContext(FloatingNavBarContext);
  if (!ctx?.content) {
    return null;
  }
  return <FloatingNavBar center={ctx.content.center} menu={ctx.content.menu} />;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
  },
  pill: {
    height: FLOATING_NAV_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderCurve: 'continuous',
    paddingLeft: 14,
    paddingRight: 6,
  },
  center: { flex: 1 },
});
