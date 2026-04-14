import { Stack } from 'expo-router';
import React from 'react';

import { ComposerProvider } from '~/components/composer/ComposerContext';
import { Composer } from '~/components/composer/Composer';
import { theme } from '~/components/theme';
import { TopAnchoredFeedProvider } from '~/services/inbox/top-anchored-feed';

const screenOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: theme.colors.background },
  headerTintColor: theme.colors.foreground,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: theme.colors.background },
  animation: 'default' as const,
  gestureEnabled: true,
};



export default function AppLayout() {
  return (
    <ComposerProvider>
      <TopAnchoredFeedProvider>
        <Stack screenOptions={screenOptions}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="notes/index" options={{ title: 'Notes' }} />
          <Stack.Screen name="notes/[id]" options={{ title: '' }} />
          <Stack.Screen name="chat/[id]" options={{ title: '' }} />
          <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
          <Stack.Screen name="settings/archived-chats" options={{ title: 'Archived Chats' }} />
        </Stack>
        <Composer />
      </TopAnchoredFeedProvider>
    </ComposerProvider>
  );
}
