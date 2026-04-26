import {
  Button as SwiftUIButton,
  Host as SwiftUIHost,
  Image as SwiftUIImage,
} from '@expo/ui/swift-ui';
import { buttonStyle, frame } from '@expo/ui/swift-ui/modifiers';
import { Stack, useRouter, type RelativePathString } from 'expo-router';
import React from 'react';

import { useThemeColors } from '~/components/theme/theme';
import { TopAnchoredFeedProvider } from '~/services/inbox/top-anchored-feed';

function SettingsButton() {
  const router = useRouter();

  return (
    <SwiftUIHost style={{ width: 44, height: 44 }}>
      <SwiftUIButton
        onPress={() => router.push('/(protected)/(tabs)/settings' as RelativePathString)}
        modifiers={[buttonStyle('borderless'), frame({ width: 44, height: 44 })]}
      >
        <SwiftUIImage systemName="gearshape" size={18} />
      </SwiftUIButton>
    </SwiftUIHost>
  );
}

export default function AppLayout() {
  const themeColors = useThemeColors();

  return (
    <TopAnchoredFeedProvider>
      <Stack
        screenOptions={{
          headerShown: true,
          headerTintColor: themeColors['icon-primary'],
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Feed',
            headerRight: () => <SettingsButton />,
          }}
        />
        <Stack.Screen name="notes/[id]" options={{}} />
        <Stack.Screen name="chat/[id]" options={{}} />
        <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
        <Stack.Screen name="settings/archived-chats" options={{ title: 'Archived Chats' }} />
      </Stack>
    </TopAnchoredFeedProvider>
  );
}
