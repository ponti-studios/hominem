import type { RelativePathString } from 'expo-router';
import { Stack, usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { InputProvider } from '~/components/input/input-context';
import { MobileComposer } from '~/components/input/mobile-composer';
import { Text, makeStyles } from '~/theme';

function NavButton({ href, label }: { href: RelativePathString; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const styles = useStyles();
  const hrefValue = String(href);
  const isActive =
    hrefValue === '/(protected)/(tabs)/'
      ? pathname === '/' || pathname === ''
      : pathname.includes(hrefValue.replace('/(protected)/(tabs)/', ''));

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
  const styles = useStyles();

  return (
    <InputProvider>
      <View style={styles.container}>
        <View style={styles.nav}>
          <NavButton href={'/(protected)/(tabs)/'} label="Feed" />
          <NavButton href={'/(protected)/(tabs)/notes'} label="Notes" />
          <NavButton href={'/(protected)/(tabs)/settings'} label="Settings" />
        </View>
        <View style={styles.content}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="notes" />
            <Stack.Screen name="chat" />
            <Stack.Screen name="settings" />
          </Stack>
          <MobileComposer />
        </View>
      </View>
    </InputProvider>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    nav: {
      flexDirection: 'row',
      gap: t.spacing.sm_12,
      paddingHorizontal: t.spacing.m_16,
      paddingTop: t.spacing.l_32,
      paddingBottom: t.spacing.sm_12,
      borderBottomWidth: 1,
      borderBottomColor: t.colors['border-default'],
    },
    navButton: {
      borderWidth: 1,
      borderColor: t.colors['border-default'],
      borderRadius: t.borderRadii.full,
      paddingHorizontal: t.spacing.m_16,
      paddingVertical: t.spacing.sm_8,
    },
    navButtonActive: {
      backgroundColor: t.colors.muted,
    },
    content: {
      flex: 1,
    },
  }),
);
