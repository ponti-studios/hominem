import { Link } from 'expo-router';
import React, { memo, useCallback, useRef } from 'react';
import { Alert, Pressable, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SharedValue } from 'react-native-reanimated';

import { Text, fontFamiliesNative, fontSizes, lineHeights, makeStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { useChatArchive } from '~/services/chat/use-chat-archive';
import { formatRelativeAge } from '~/services/date/format-relative-age';
import { useNoteDelete } from '~/services/notes/use-note-delete';
import t from '~/translations';

import type { InboxStreamItemData as InboxStreamItemModel } from './InboxStreamItem.types';

const KIND_ICON = {
  note: 'doc.text',
  chat: 'bubble.left',
} as const;

interface InboxStreamItemProps {
  item: InboxStreamItemModel;
}

export const InboxStreamItem = memo(({ item }: InboxStreamItemProps) => {
  const styles = useStyles();
  const swipeableRef = useRef<SwipeableMethods>(null);
  const titleText = cleanText(item.title);
  const previewText = cleanText(item.preview);
  const primaryText = titleText ?? previewText ?? t.workspace.item.untitled;
  const isChat = item.kind === 'chat';
  const timeAgo = formatRelativeAge(item.updatedAt);

  const { mutate: deleteNote, isPending: isDeletingNote } = useNoteDelete({
    noteId: item.entityId,
  });
  const { mutate: archiveChat, isPending: isArchivingChat } = useChatArchive({
    chatId: item.entityId,
  });
  const isPending = isDeletingNote || isArchivingChat;

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close();
    Alert.alert(t.workspace.item.deleteNote.title, t.workspace.item.deleteNote.message, [
      { text: t.workspace.item.deleteNote.cancel, style: 'cancel' },
      {
        text: t.workspace.item.deleteNote.confirm,
        style: 'destructive',
        onPress: () => deleteNote(),
      },
    ]);
  }, [deleteNote]);

  const handleArchive = useCallback(() => {
    swipeableRef.current?.close();
    archiveChat();
  }, [archiveChat]);

  const renderSwipeAction = useCallback(
    (_progress: SharedValue<number>, _translation: SharedValue<number>) => {
      return (
        <Pressable
          style={[styles.swipeAction, isChat ? styles.swipeActionArchive : styles.swipeActionDelete]}
          onPress={isChat ? handleArchive : handleDelete}
          accessibilityLabel={isChat ? t.workspace.item.archive : t.workspace.item.deleteNote.confirm}
          accessibilityRole="button"
        >
          <AppIcon name={isChat ? 'archivebox' : 'trash'} size={20} tintColor="white" />
        </Pressable>
      );
    },
    [isChat, handleArchive, handleDelete, styles],
  );

  return (
    <View style={[styles.cardOuter, isPending && styles.rowPending]} testID={`inbox-item-${item.kind}`}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        containerStyle={styles.swipeableContainer}
        renderRightActions={renderSwipeAction}
        rightThreshold={60}
        friction={2}
        overshootRight={false}
      >
        <Link href={item.route} disabled={isPending} asChild>
          <Link.Trigger withAppleZoom>
            <Pressable
              accessibilityLabel={`${primaryText}, ${isChat ? 'Chat' : 'Note'}`}
              accessibilityRole="button"
              disabled={isPending}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.titleRow}>
                <AppIcon
                  name={KIND_ICON[item.kind]}
                  size={13}
                  tintColor={undefined}
                  style={styles.kindIcon}
                />
                <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                  {primaryText}
                </Text>
                <Text style={styles.time}>{timeAgo}</Text>
              </View>
            </Pressable>
          </Link.Trigger>
        </Link>
      </ReanimatedSwipeable>
    </View>
  );
});

InboxStreamItem.displayName = 'InboxStreamItem';

function cleanText(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

const useStyles = makeStyles((theme) => ({
  cardOuter: {
    marginHorizontal: 12,
    marginBottom: 4,
  },
  swipeableContainer: {
    borderRadius: 12,
  },
  row: {
    paddingHorizontal: 14,
    backgroundColor: theme.colors['bg-surface'],
  },
  rowPressed: {
    backgroundColor: theme.colors['bg-elevated'],
  },
  rowPending: {
    opacity: 0.45,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  kindIcon: {
    flexShrink: 0,
    opacity: 0.4,
  },
  title: {
    flex: 1,
    color: theme.colors['text-primary'],
    fontSize: fontSizes.md,
    fontFamily: fontFamiliesNative.primary,
    fontWeight: '600',
    lineHeight: lineHeights.body,
    letterSpacing: -0.1,
  },
  time: {
    color: theme.colors['text-tertiary'],
    fontSize: fontSizes.sm,
    fontFamily: fontFamiliesNative.primary,
    lineHeight: lineHeights.caption,
  },
  swipeAction: {
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActionDelete: {
    backgroundColor: theme.colors.destructive,
  },
  swipeActionArchive: {
    backgroundColor: theme.colors['text-tertiary'],
  },
}));
