import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FadeIn } from '~/components/animated/FadeIn';
import { makeStyles, Text, theme } from '~/components/theme';
import { formatRelativeAge } from '~/services/date/format-relative-age';
import type { ChatWithActivity } from '~/services/chat/session-state';

import AppIcon from '../ui/icon';

interface InboxItemProps {
  chat: ChatWithActivity;
  isActive?: boolean;
}

export const InboxItem = memo(({ chat, isActive }: InboxItemProps) => {
  const styles = useStyles();
  const router = useRouter();

  const handlePress = useCallback(() => {
    router.push(`/(protected)/(tabs)/chat/${chat.id}` as RelativePathString);
  }, [router, chat.id]);

  const label = chat.title ?? 'Untitled session';

  return (
    <FadeIn>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.card,
          isActive && styles.activeCard,
          pressed && styles.pressed,
        ]}
        accessibilityLabel={`Resume session: ${label}`}
        accessibilityRole="button"
      >
        <View style={[styles.iconWrap, isActive && styles.activeIconWrap]}>
          <AppIcon
            name="bubble.left"
            size={14}
            color={isActive ? theme.colors.background : theme.colors['text-tertiary']}
          />
        </View>
        <View style={styles.content}>
          <Text variant="label" color="foreground" numberOfLines={1}>
            {label}
          </Text>
          <Text variant="small" color="text-tertiary">
            {isActive ? 'Active' : formatRelativeAge(chat.activityAt)}
          </Text>
        </View>
        <AppIcon name="chevron.right" size={12} color={theme.colors['text-tertiary']} />
      </Pressable>
    </FadeIn>
  );
});

InboxItem.displayName = 'InboxItem';

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm_12,
      borderWidth: 1,
      borderColor: t.colors['border-default'],
      borderRadius: t.borderRadii.md,
      backgroundColor: t.colors.background,
      paddingHorizontal: t.spacing.m_16,
      paddingVertical: t.spacing.sm_12,
    },
    activeCard: {
      borderColor: t.colors['border-focus'],
    },
    pressed: {
      opacity: 0.7,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: t.borderRadii.md,
      borderWidth: 1,
      borderColor: t.colors['border-default'],
      backgroundColor: t.colors['bg-surface'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeIconWrap: {
      backgroundColor: t.colors.foreground,
      borderColor: t.colors.foreground,
    },
    content: {
      flex: 1,
      gap: t.spacing.xs_4,
    },
  }),
);
