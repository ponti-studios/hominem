import { useApiClient } from '@hominem/rpc/react';
import { useQuery } from '@tanstack/react-query';
import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FadeIn } from '~/components/animated/fade-in';
import { makeStyles, Text, theme } from '~/theme';
import { formatRelativeAge } from '~/utils/date/format-relative-age';
import type { ChatWithActivity } from '~/utils/services/chat/session-state';
import {
  getArchivedChatsWithActivity,
  getInboxChatsWithActivity,
} from '~/utils/services/chat/session-state';
import { chatKeys } from '~/utils/services/notes/query-keys';

import AppIcon from '../ui/icon';

export const useResumableSessions = () => {
  const client = useApiClient();

  return useQuery<ChatWithActivity[]>({
    queryKey: chatKeys.resumableSessions,
    queryFn: async () => {
      const chats = await client.chats.list({ limit: 50 });
      return getInboxChatsWithActivity(chats);
    },
  });
};

export const useArchivedSessions = () => {
  const client = useApiClient();

  return useQuery<ChatWithActivity[]>({
    queryKey: chatKeys.archivedSessions,
    queryFn: async () => {
      const chats = await client.chats.list({ limit: 100 });
      return getArchivedChatsWithActivity(chats);
    },
  });
};

interface SessionCardProps {
  chat: ChatWithActivity;
  isActive?: boolean;
}

export const SessionCard = memo(({ chat, isActive }: SessionCardProps) => {
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

SessionCard.displayName = 'SessionCard';

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
