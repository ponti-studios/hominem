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
  variant?: 'card' | 'compact' | 'plain';
  showKindLabel?: boolean;
  showTimestamp?: boolean;
  swipeEnabled?: boolean;
  showLeadingIcon?: boolean;
}

export const InboxStreamItem = memo(
  ({
    item,
    variant = 'card',
    showKindLabel = false,
    showTimestamp = true,
    swipeEnabled = true,
    showLeadingIcon = true,
  }: InboxStreamItemProps) => {
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
            style={[
              styles.swipeAction,
              isChat ? styles.swipeActionArchive : styles.swipeActionDelete,
            ]}
            onPress={isChat ? handleArchive : handleDelete}
            accessibilityLabel={
              isChat ? t.workspace.item.archive : t.workspace.item.deleteNote.confirm
            }
            accessibilityRole="button"
          >
            <AppIcon name={isChat ? 'archivebox' : 'trash'} size={20} tintColor="white" />
          </Pressable>
        );
      },
      [isChat, handleArchive, handleDelete, styles],
    );

    const row = (
      <Link href={item.route} disabled={isPending} asChild>
        <Link.Trigger withAppleZoom>
          <Pressable
            accessibilityLabel={`${primaryText}, ${isChat ? 'Chat' : 'Note'}`}
            accessibilityRole="button"
            disabled={isPending}
            style={({ pressed }) => [
              styles.row,
              variant === 'card'
                ? styles.rowCard
                : variant === 'plain'
                  ? styles.rowPlain
                  : styles.rowCompact,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.titleRow}>
              {showLeadingIcon ? (
                <AppIcon
                  name={KIND_ICON[item.kind]}
                  size={13}
                  tintColor={undefined}
                  style={styles.kindIcon}
                />
              ) : null}
              <View style={styles.copyColumn}>
                <Text
                  style={styles.title}
                  numberOfLines={variant === 'plain' ? 2 : 1}
                  ellipsizeMode="tail"
                >
                  {primaryText}
                </Text>
                {showKindLabel || showTimestamp ? (
                  <View style={styles.metaRow}>
                    {showKindLabel ? (
                      <Text style={styles.kindLabel}>
                        {item.kind === 'chat'
                          ? t.workspace.item.chatLabel
                          : t.workspace.item.noteLabel}
                      </Text>
                    ) : null}
                    {showTimestamp ? <Text style={styles.time}>{timeAgo}</Text> : null}
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        </Link.Trigger>
      </Link>
    );

    return (
      <View
        style={[
          variant === 'card' ? styles.cardOuter : styles.compactOuter,
          isPending && styles.rowPending,
        ]}
        testID={`inbox-item-${item.kind}`}
      >
        {swipeEnabled ? (
          <ReanimatedSwipeable
            ref={swipeableRef}
            containerStyle={styles.swipeableContainer}
            renderRightActions={renderSwipeAction}
            rightThreshold={60}
            friction={2}
            overshootRight={false}
          >
            {row}
          </ReanimatedSwipeable>
        ) : (
          row
        )}
      </View>
    );
  },
);

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
  compactOuter: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  swipeableContainer: {
    borderRadius: 12,
  },
  row: {
    backgroundColor: theme.colors['bg-base'],
  },
  rowCard: {
    backgroundColor: theme.colors['bg-surface'],
    paddingHorizontal: 14,
  },
  rowCompact: {
    paddingHorizontal: 4,
  },
  rowPlain: {
    backgroundColor: theme.colors['bg-base'],
    paddingHorizontal: 0,
  },
  rowPressed: {
    opacity: 0.64,
  },
  rowPending: {
    opacity: 0.45,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 15,
  },
  kindIcon: {
    flexShrink: 0,
    opacity: 0.4,
    marginTop: 3,
  },
  copyColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: theme.colors['text-primary'],
    fontSize: fontSizes.lg,
    fontFamily: fontFamiliesNative.primary,
    fontWeight: '400',
    lineHeight: lineHeights.body,
    letterSpacing: -0.25,
  },
  metaRow: {
    alignItems: 'center',
    columnGap: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  kindLabel: {
    color: theme.colors['text-tertiary'],
    fontSize: fontSizes.caption1,
    fontFamily: fontFamiliesNative.primary,
    lineHeight: lineHeights.caption,
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
