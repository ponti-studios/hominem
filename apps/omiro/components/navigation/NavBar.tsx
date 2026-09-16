import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, withAlpha } from '~/components/theme';

export const NAV_BAR_HEIGHT = 40;

interface NavBarProps {
  center: ReactNode;
  menu: ReactNode;
}

// A static bar pinned to the top of the layout, in normal flow above the
// Stack (see (protected)/_layout.tsx) -- it reserves its own space so screen
// content always starts below it instead of scrolling underneath it. Flat
// and edge-to-edge, not a floating card: a bottom hairline separates it from
// the content below instead of a shadow/margin implying it's overlaid.
export function NavBar({ center, menu }: NavBarProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.wrap, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.bar, { borderBottomColor: withAlpha(theme.colors.border, 0.5) }]}>
        <View style={styles.center}>{center}</View>
        {menu}
      </View>
    </View>
  );
}

interface NavBarContent {
  center: ReactNode;
  menu: ReactNode;
}

interface NavBarContextValue {
  content: NavBarContent | null;
  setContent: (content: NavBarContent | null) => void;
}

const NavBarContext = createContext<NavBarContextValue | null>(null);

// Wraps the Stack navigator so Stream and Time can render into one shared
// NavBar instance mounted above the Stack, instead of each screen mounting
// (and remounting on navigation) its own bar.
export function NavBarProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<NavBarContent | null>(null);
  const value = useMemo(() => ({ content, setContent }), [content]);
  return <NavBarContext.Provider value={value}>{children}</NavBarContext.Provider>;
}

// Screens call this to publish what the shared NavBar should show while
// they're focused. Content is cleared only on unmount (not on every content
// change) so switching between screens that both use it never flashes an
// empty bar in between.
export function useNavBarContent(content: NavBarContent) {
  const ctx = useContext(NavBarContext);
  if (!ctx) {
    throw new Error('useNavBarContent must be used within a NavBarProvider');
  }
  const { setContent } = ctx;
  useEffect(() => {
    setContent(content);
  }, [content, setContent]);
  useEffect(() => () => setContent(null), [setContent]);
}

// The single NavBar instance, rendered once above the Stack. Renders nothing
// when no focused screen has published content.
export function SharedNavBar() {
  const ctx = useContext(NavBarContext);
  if (!ctx?.content) {
    return null;
  }
  return <NavBar center={ctx.content.center} menu={ctx.content.menu} />;
}

const styles = StyleSheet.create({
  wrap: {},
  bar: {
    height: NAV_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingLeft: 16,
    paddingRight: 8,
  },
  center: { flex: 1 },
});
