import { DrawerActions } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useNavigation, useRouter, type RelativePathString } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { Platform, Pressable } from 'react-native';

import { makeStyles } from '~/components/theme';
import { useThemeColors } from '~/components/theme/theme';
import { SidebarContent } from '~/components/workspace/SidebarContent';
import { SidebarLayout } from '~/components/workspace/SidebarLayout';
import { TopAnchoredFeedProvider } from '~/services/inbox/top-anchored-feed';

const SIDEBAR_WIDTH_IPAD = 360;
const SIDEBAR_WIDTH_IPHONE = 320;

function SidebarToggleButton({ hidden }: { hidden?: boolean }) {
  const navigation = useNavigation();
  const themeColors = useThemeColors();
  const headerButtonStyles = useHeaderButtonStyles();

  if (hidden) {
    return null;
  }

  return (
    <Pressable
      accessibilityLabel="Open sidebar"
      hitSlop={10}
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      style={headerButtonStyles.button}
    >
      <Image
        source="sf:sidebar.left"
        style={headerButtonStyles.icon}
        tintColor={themeColors['icon-primary']}
        contentFit="contain"
      />
    </Pressable>
  );
}

function SettingsButton() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const headerButtonStyles = useHeaderButtonStyles();

  return (
    <Pressable
      accessibilityLabel="Settings"
      hitSlop={10}
      onPress={() => router.push('/(protected)/(tabs)/settings' as RelativePathString)}
      style={headerButtonStyles.button}
    >
      <Image
        source="sf:gearshape"
        style={headerButtonStyles.icon}
        tintColor={themeColors['icon-primary']}
        contentFit="contain"
      />
    </Pressable>
  );
}

const useHeaderButtonStyles = makeStyles(() => ({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    width: 36,
  },
  icon: {
    height: 18,
    width: 18,
  },
}));

export default function AppLayout() {
  const themeColors = useThemeColors();
  const isSidebarPinned = Platform.OS === 'ios' && Platform.isPad;

  return (
    <TopAnchoredFeedProvider>
      <SidebarLayout>
        <Drawer
          screenOptions={{
            headerShown: true,
            headerStyle: { backgroundColor: themeColors.background },
            headerTintColor: themeColors['icon-primary'],
            headerShadowVisible: false,
            sceneStyle: { backgroundColor: themeColors.background },
            drawerType: isSidebarPinned ? 'permanent' : 'front',
            swipeEnabled: !isSidebarPinned,
            drawerStyle: {
              // backgroundColor: themeColors.background,
              width: isSidebarPinned ? SIDEBAR_WIDTH_IPAD : SIDEBAR_WIDTH_IPHONE,
            },
          }}
          drawerContent={() => <SidebarContent />}
        >
          <Drawer.Screen
            name="index"
            options={{
              title: 'Feed',
              headerLeft: () => <SidebarToggleButton hidden={isSidebarPinned} />,
              headerRight: () => <SettingsButton />,
            }}
          />
          <Drawer.Screen name="notes/[id]" options={{ drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="chat/[id]" options={{ drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen name="settings/index" options={{ drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen
            name="settings/archived-chats"
            options={{ drawerItemStyle: { display: 'none' } }}
          />
        </Drawer>
      </SidebarLayout>
    </TopAnchoredFeedProvider>
  );
}
