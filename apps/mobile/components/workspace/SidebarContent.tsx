import { DrawerActions, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router/build/hooks';
import React, { useCallback } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, makeStyles, radii, spacing } from '~/components/theme';
import { useThemeColors } from '~/components/theme/theme';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';

import { InboxStreamItemPresentation } from './InboxStreamItemPresentation';
import { useSidebarLayout } from './SidebarLayout';

export function SidebarContent() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const navigation = useNavigation();
  const router = useRouter();
  const pathname = usePathname();
  const { isSidebarPinned } = useSidebarLayout();
  const { items } = useInboxStreamItems();

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
      if (!isSidebarPinned) {
        navigation.dispatch(DrawerActions.closeDrawer());
      }
    },
    [isSidebarPinned, navigation, router],
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing[3] }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Pressable
          onPress={() => navigate('/(protected)/(tabs)')}
          style={({ pressed }) => [
            styles.feedButton,
            pathname === '/(protected)/(tabs)' && styles.feedButtonActive,
            pressed && styles.feedButtonPressed,
          ]}
        >
          <Image
            source="sf:rectangle.stack"
            style={styles.feedIcon}
            tintColor={themeColors.foreground}
            contentFit="contain"
          />
          <Text style={styles.feedButtonText}>Feed</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text variant="overline" color="text-tertiary" style={styles.sectionTitle}>
          Recent
        </Text>
        {items.length === 0 ? <Text style={styles.emptyText}>Nothing in the feed yet</Text> : null}
        {items.map((item) => {
          const isActive = pathname === item.route;
          return (
            <Pressable
              key={item.id}
              onPress={() => navigate(item.route)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <InboxStreamItemPresentation item={item} compact isActive={isActive} showPreview />
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((theme) => ({
  container: {
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[6],
    gap: spacing[4],
  },
  section: {},
  sectionTitle: {
    paddingHorizontal: spacing[1],
    marginBottom: spacing[1],
  },
  feedButton: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
    paddingHorizontal: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  feedButtonActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors['bg-elevated'],
  },
  feedButtonPressed: {
    opacity: 0.86,
  },
  feedIcon: {
    width: 18,
    height: 18,
  },
  feedButtonText: {
    color: theme.colors.foreground,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    color: theme.colors['text-tertiary'],
    fontSize: 13,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  row: {},
  rowPressed: {
    opacity: 0.92,
  },
}));
