import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import { InputProvider } from '~/components/input/input-context';
import { MobileComposer } from '~/components/input/mobile-composer';
import { makeStyles, theme } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { useReducedMotion } from '~/hooks/use-reduced-motion';

export default function TabsLayout() {
  const styles = useStyles();
  const prefersReducedMotion = useReducedMotion();

  const handleTabPress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <InputProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors['text-secondary'],
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarIconStyle: styles.tabBarIcon,
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color }) => (
              <AppIcon name="tray" size={24} color={color} />
            ),
          }}
          listeners={{
            tabPress: () => {
              handleTabPress();
            },
          }}
        />
        <Tabs.Screen
          name="notes"
          options={{
            tabBarLabel: 'Notes',
            tabBarIcon: ({ color }) => (
              <AppIcon name="note.text" size={24} color={color} />
            ),
          }}
          listeners={{
            tabPress: () => {
              handleTabPress();
            },
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            tabBarLabel: 'Chat',
            tabBarIcon: ({ color }) => (
              <AppIcon name="bubble.left" size={24} color={color} />
            ),
          }}
          listeners={{
            tabPress: () => {
              handleTabPress();
            },
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            tabBarLabel: 'Settings',
            tabBarIcon: ({ color }) => (
              <AppIcon name="gearshape" size={24} color={color} />
            ),
          }}
          listeners={{
            tabPress: () => {
              handleTabPress();
            },
          }}
        />
      </Tabs>
      <MobileComposer />
    </InputProvider>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    tabBar: {
      borderTopWidth: 1,
      borderTopColor: t.colors['border-default'],
      backgroundColor: t.colors.background,
      paddingBottom: 8,
      paddingTop: 8,
      height: 64,
    },
    tabBarLabel: {
      fontSize: 12,
      marginTop: 4,
    },
    tabBarIcon: {
      marginTop: 0,
    },
  }),
);
