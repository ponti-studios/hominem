import { Stack } from 'expo-router';
import React from 'react';

import { useThemeColors } from '~/components/theme';
import { TopAnchoredFeedProvider } from '~/services/inbox/top-anchored-feed';

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
            title: 'Workspace',
            headerLargeTitle: true,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen name="inbox/[kind]/[id]" options={{}} />
        <Stack.Screen name="notes/[id]" options={{}} />
        <Stack.Screen name="chat/[id]" options={{}} />
        <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
        <Stack.Screen name="settings/archived-chats" options={{ title: 'Archived Chats' }} />
      </Stack>
    </TopAnchoredFeedProvider>
  );
}
