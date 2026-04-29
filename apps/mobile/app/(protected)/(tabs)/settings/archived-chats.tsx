import { useIsFocused } from '@react-navigation/native';
import type { RelativePathString } from 'expo-router';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';
import { useArchivedSessions } from '~/hooks/useArchivedSessions';
import { formatRelativeAge } from '~/services/date/format-relative-age';

export default function ArchivedChatsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { data: chats = [] } = useArchivedSessions({ enabled: isFocused });
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
          title: t.settings.archivedChatsScreen.title,
        }}
      />
      <ArchivedChatsSwiftUI chats={chats} onPressChat={onPressChat} />
    </>
  );
}

function ArchivedChatsSwiftUI({
  chats,
  onPressChat,
}: {
  chats: NonNullable<ReturnType<typeof useArchivedSessions>['data']>;
  onPressChat: (chatId: string) => void;
}) {
  const themeColors = useThemeColors();

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: themeColors['bg-surface'],
            borderColor: themeColors['border-default'],
          },
        ]}
      >
        <Text style={[styles.eyebrow, { color: themeColors['text-secondary'] }]}>
          {t.settings.archivedChatsScreen.eyebrow}
        </Text>
        <Text style={[styles.title, { color: themeColors.foreground }]}>
          {t.settings.archivedChatsScreen.title}
        </Text>
        <Text style={[styles.helperText, { color: themeColors['text-secondary'] }]}>
          {t.settings.archivedChatsScreen.description}
        </Text>
      </View>

      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: themeColors['bg-surface'],
            borderColor: themeColors['border-default'],
          },
        ]}
      >
        {chats.length > 0 ? (
          chats.map((chat) => (
            <Pressable
              key={chat.id}
              onPress={() => onPressChat(chat.id)}
              style={({ pressed }) => [styles.chatRow, { opacity: pressed ? 0.7 : 1 }]}
            >
              <AppIcon name="tray" size={14} tintColor={themeColors['text-secondary']} />
              <View style={styles.chatCopy}>
                <Text style={[styles.chatTitle, { color: themeColors.foreground }]}>
                  {chat.title ?? t.workspace.item.untitledSession}
                </Text>
                <Text style={[styles.chatMeta, { color: themeColors['text-secondary'] }]}>
                  Archived {formatRelativeAge(chat.archivedAt ?? chat.activityAt)}
                </Text>
              </View>
              <AppIcon name="chevron.right" size={12} tintColor={themeColors['text-tertiary']} />
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: themeColors.foreground }]}>
              {t.settings.archivedChatsScreen.emptyTitle}
            </Text>
            <Text style={[styles.emptyCopy, { color: themeColors['text-secondary'] }]}>
              {t.settings.archivedChatsScreen.emptyCopy}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chatCopy: {
    flex: 1,
    gap: 2,
  },
  chatMeta: {
    fontSize: 12,
  },
  chatRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingVertical: 6,
  },
  chatTitle: {
    fontSize: 15,
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    gap: 2,
    paddingVertical: 2,
  },
  emptyTitle: {
    fontSize: 15,
  },
  eyebrow: {
    fontSize: 13,
  },
  helperText: {
    fontSize: 16,
    lineHeight: 22,
  },
  scrollContent: {
    gap: 16,
    padding: 16,
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
});
