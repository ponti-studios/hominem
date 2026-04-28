import { Stack, useRouter, type RelativePathString } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';

import { useThemeColors } from '~/components/theme/theme';
import AppIcon from '~/components/ui/icon';
import { TopAnchoredFeedProvider } from '~/services/inbox/top-anchored-feed';

function SettingsButton() {
  const router = useRouter();
  const themeColors = useThemeColors();

  return (
    <Pressable
      hitSlop={6}
      onPress={() => router.push('/(protected)/(tabs)/settings' as RelativePathString)}
      style={({ pressed }) => ({
        alignItems: 'center',
        height: 44,
        justifyContent: 'center',
        opacity: pressed ? 0.65 : 1,
        width: 44,
      })}
    >
      <AppIcon color={themeColors['icon-primary']} name="gearshape" size={18} />
    </Pressable>
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
