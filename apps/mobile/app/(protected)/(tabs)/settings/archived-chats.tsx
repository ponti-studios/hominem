import type { RelativePathString } from 'expo-router';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Text, makeStyles } from '~/components/theme';
import { useThemeColors } from '~/components/theme/theme';
import { radii, spacing } from '~/components/theme/tokens';
import AppIcon from '~/components/ui/icon';
import { useArchivedSessions } from '~/hooks/useArchivedSessions';
import { formatRelativeAge } from '~/services/date/format-relative-age';

export default function ArchivedChatsScreen() {
  const router = useRouter();
  const { data: chats = [] } = useArchivedSessions();
  const styles = useArchivedChatsStyles();
  const themeColors = useThemeColors();

  const onPressChat = useCallback(
    (chatId: string) => {
      router.push(`/(protected)/(tabs)/chat/${chatId}` as RelativePathString);
    },
    [router],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Archived chats',
        }}
      />
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          testID="archived-chats-screen"
        >
          <Text variant="caption1" color="text-secondary" style={styles.label}>
            Archived chats
          </Text>
          <Text variant="title1" color="foreground">
            Revisit past conversations
          </Text>
          <Text variant="body" color="text-secondary">
            Archived chats are hidden from the main chat flow but remain available here.
          </Text>

          {chats.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text variant="body" color="foreground">
                No archived chats yet
              </Text>
              <Text variant="body" color="text-secondary">
                Chats you archive will appear here for later reference.
              </Text>
            </View>
          ) : (
            chats.map((chat) => (
              <Pressable
                key={chat.id}
                onPress={() => onPressChat(chat.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open archived chat: ${chat.title ?? 'Untitled session'}`}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View style={styles.iconWrap}>
                  <AppIcon name="tray" size={14} color={themeColors['text-tertiary']} />
                </View>
                <View style={styles.cardContent}>
                  <Text variant="callout" color="foreground" numberOfLines={1}>
                    {chat.title ?? 'Untitled session'}
                  </Text>
                  <Text variant="caption1" color="text-tertiary">
                    Archived {formatRelativeAge(chat.archivedAt ?? chat.activityAt)}
                  </Text>
                </View>
                <AppIcon name="chevron.right" size={12} color={themeColors['text-tertiary']} />
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </>
  );
}

const useArchivedChatsStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
  },
  content: {
    gap: spacing[3],
    paddingBottom: spacing[7],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
  },
  label: {
    letterSpacing: 1,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
    borderRadius: radii.md,
    gap: spacing[2],
    marginTop: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[8],
  },
  card: {
    alignItems: 'center',
    borderColor: theme.colors['border-default'],
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  pressed: {
    opacity: 0.7,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-default'],
    borderRadius: radii.md,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  cardContent: {
    flex: 1,
    gap: spacing[1],
  },
}));
