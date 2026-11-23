import { Drawer } from '@ponti-studios/rnkit';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setSideDrawerOpen, useSideDrawerOpen } from '~/components/navigation/side-drawer-store';
import { useAppTheme, useStyles, withAlpha } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { CHAT_ROUTE, NOTES_ROUTE, SETTINGS_ROUTE, TASKS_ROUTE } from '~/services/navigation/routes';

// The drawer lists the app's existing destinations and nothing else, so it
// adds a second way to reach Chats, Notes and Tasks without changing them.
const DESTINATIONS = [
  { label: 'Chat', icon: 'bubble.left', route: CHAT_ROUTE, id: 'chat' },
  { label: 'Notes', icon: 'note.text', route: NOTES_ROUTE, id: 'notes' },
  { label: 'Tasks', icon: 'checkmark.circle', route: TASKS_ROUTE, id: 'tasks' },
  { label: 'Settings', icon: 'gearshape', route: SETTINGS_ROUTE, id: 'settings' },
] as const;

function DrawerMenu() {
  const insets = useSafeAreaInsets();
  const { foreground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    menu: { flex: 1, gap: 4, paddingHorizontal: 16, paddingTop: insets.top + 24 },
    row: {
      alignItems: 'center',
      borderRadius: 14,
      flexDirection: 'row',
      gap: 14,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    rowPressed: { backgroundColor: withAlpha(theme.colors.foreground, 0.08) },
    label: { ...theme.textVariants.body, color: theme.colors.foreground },
  }));

  return (
    <View style={styles.menu}>
      {DESTINATIONS.map((destination) => (
        <Pressable
          key={destination.id}
          accessibilityRole="button"
          accessibilityLabel={destination.label}
          onPress={() => {
            setSideDrawerOpen(false);
            if (destination.id === 'settings') {
              router.push(destination.route);
            } else {
              router.navigate(destination.route);
            }
          }}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          testID={`side-drawer-${destination.id}`}
        >
          <AppIcon name={destination.icon} size={22} tintColor={foreground} />
          <Text style={styles.label}>{destination.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// Wraps the tab shell: the tabs slide right to show the menu behind them.
export function SideDrawer({ children }: { children: ReactNode }) {
  const open = useSideDrawerOpen();
  const { background, foreground } = useAppTheme().colors;
  return (
    <Drawer
      open={open}
      onOpenChange={setSideDrawerOpen}
      drawer=<DrawerMenu />
      colors={{
        background,
        scrim: background,
        rim: withAlpha(foreground, 0.22),
      }}
      closeLabel="Close menu"
      testIDPrefix="side-drawer"
    >
      {children}
    </Drawer>
  );
}
