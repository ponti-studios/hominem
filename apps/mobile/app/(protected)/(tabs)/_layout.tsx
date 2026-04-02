import type { RelativePathString } from 'expo-router';
import { Stack, usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text, theme } from '~/theme';

function NavButton({ href, label }: { href: RelativePathString; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = pathname.includes(href.replace('/(protected)/(tabs)/', ''));

  return (
    <Pressable
      onPress={() => router.replace(href)}
      style={[styles.navButton, isActive && styles.navButtonActive]}
    >
      <Text variant="body" color={isActive ? 'foreground' : 'text-secondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <View style={styles.container}>
      <View style={styles.nav}>
        <NavButton href={'/(protected)/(tabs)/notes' as RelativePathString} label="Notes" />
        <NavButton href={'/(protected)/(tabs)/chat' as RelativePathString} label="Chat" />
        <NavButton href={'/(protected)/(tabs)/account' as RelativePathString} label="Account" />
      </View>
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="notes" />
          <Stack.Screen name="focus" />
          <Stack.Screen name="chat" />
          <Stack.Screen name="start" />
          <Stack.Screen name="account" />
        </Stack>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  nav: {
    flexDirection: 'row',
    gap: theme.spacing.sm_12,
    paddingHorizontal: theme.spacing.m_16,
    paddingTop: theme.spacing.l_32,
    paddingBottom: theme.spacing.sm_12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors['border-default'],
  },
  navButton: {
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
    borderRadius: theme.borderRadii.full,
    paddingHorizontal: theme.spacing.m_16,
    paddingVertical: theme.spacing.sm_8,
  },
  navButtonActive: {
    backgroundColor: theme.colors.muted,
  },
  content: {
    flex: 1,
  },
});
