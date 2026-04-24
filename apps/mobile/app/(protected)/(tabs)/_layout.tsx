import {
  Button as SwiftUIButton,
  Host as SwiftUIHost,
  Image as SwiftUIImage,
} from '@expo/ui/swift-ui';
import { buttonStyle, frame } from '@expo/ui/swift-ui/modifiers';
import { DrawerActions } from '@react-navigation/native';
import { useNavigation, useRouter, type RelativePathString } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { Platform } from 'react-native';

import { useThemeColors } from '~/components/theme/theme';
import { SidebarContent } from '~/components/workspace/SidebarContent';
import { SidebarLayout } from '~/components/workspace/SidebarLayout';
import { TopAnchoredFeedProvider } from '~/services/inbox/top-anchored-feed';

const SIDEBAR_WIDTH_IPAD = 360;
const SIDEBAR_WIDTH_IPHONE = 320;

function SidebarToggleButton({ hidden }: { hidden?: boolean }) {
  const navigation = useNavigation();

  if (hidden) {
    return null;
  }

  return (
    <SwiftUIHost matchContents style={{ width: 36, height: 36 }}>
      <SwiftUIButton
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        modifiers={[buttonStyle('glass'), frame({ width: 36, height: 36 })]}
      >
        <SwiftUIImage systemName="sidebar.left" size={18} />
      </SwiftUIButton>
    </SwiftUIHost>
  );
}

function SettingsButton() {
  const router = useRouter();

  return (
    <SwiftUIHost matchContents style={{ width: 36, height: 36 }}>
      <SwiftUIButton
        onPress={() => router.push('/(protected)/(tabs)/settings' as RelativePathString)}
        modifiers={[buttonStyle('glass'), frame({ width: 36, height: 36 })]}
      >
        <SwiftUIImage systemName="gearshape" size={18} />
      </SwiftUIButton>
    </SwiftUIHost>
  );
}

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
