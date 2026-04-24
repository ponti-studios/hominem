import { Stack } from 'expo-router';
import React from 'react';

import { useThemeColors } from '~/components/theme/theme';
import { TopAnchoredFeedProvider } from '~/services/inbox/top-anchored-feed';

export default function AppLayout() {
  const themeColors = useThemeColors();

  return (
    <TopAnchoredFeedProvider>
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: themeColors.background },
          headerTintColor: themeColors.foreground,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: themeColors.background },
          animation: 'default',
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="notes/index" options={{ title: 'Notes' }} />
        <Stack.Screen name="notes/[id]" options={{ title: '' }} />
        <Stack.Screen name="chat/[id]" options={{ title: '' }} />
        <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
        <Stack.Screen name="settings/archived-chats" options={{ title: 'Archived Chats' }} />
      </Stack>
    </TopAnchoredFeedProvider>
  );
}
