import { Link } from 'expo-router';
import React, { memo, useCallback } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Reanimated, { Easing, FadeIn } from 'react-native-reanimated';

import {
  Text,
  fontFamiliesNative,
  fontSizes,
  fontWeights,
  lineHeights,
  makeStyles,
  useThemeColors,
} from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { useChatArchive } from '~/services/chat/use-chat-archive';
import { formatRelativeAge } from '~/services/date/format-relative-age';
import { useNoteDelete } from '~/services/notes/use-note-delete';
import t from '~/translations';

import { ArtifactPreviewCard } from './ArtifactPreviewCard';
import type { InboxStreamItemData as InboxStreamItemModel } from './InboxStreamItem.types';

const entering = FadeIn.duration(180).easing(Easing.out(Easing.quad));

interface InboxStreamItemProps {
  item: InboxStreamItemModel;
}

export const InboxStreamItem = memo(({ item }: InboxStreamItemProps) => {
  const styles = useStyles();
  const themeColors = useThemeColors();
  const primaryText = cleanText(item.title) ?? t.workspace.item.untitled;
  const previewText = cleanText(item.preview);
  const isChat = item.kind === 'chat';
  const iconName = isChat ? 'bubble.left.fill' : 'note.text';
  const timeAgo = formatRelativeAge(item.updatedAt);

  const { mutate: deleteNote, isPending: isDeletingNote } = useNoteDelete({
    noteId: item.entityId,
  });
  const { mutate: archiveChat, isPending: isArchivingChat } = useChatArchive({
    chatId: item.entityId,
  });
  const isPending = isDeletingNote || isArchivingChat;

  const handleDelete = useCallback(() => {
    Alert.alert(t.workspace.item.deleteNote.title, t.workspace.item.deleteNote.message, [
      { text: t.workspace.item.deleteNote.cancel, style: 'cancel' },
      { text: t.workspace.item.deleteNote.confirm, style: 'destructive', onPress: () => deleteNote() },
    ]);
  }, [deleteNote]);

  const handleArchive = useCallback(() => {
    archiveChat();
  }, [archiveChat]);

  return (
    <Reanimated.View entering={entering} style={isPending && styles.rowPending}>
      <Link href={item.route} disabled={isPending} asChild>
        <Link.Trigger withAppleZoom>
          <Pressable
            accessibilityLabel={`${primaryText}, ${isChat ? 'Chat' : 'Note'}`}
            accessibilityRole="button"
            disabled={isPending}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                  {primaryText}
                </Text>
                <View style={styles.meta}>
                  <AppIcon name={iconName} size={11} tintColor={themeColors['text-tertiary']} />
                  <Text style={styles.time}>{timeAgo}</Text>
                </View>
              </View>
              {previewText ? (
                <Text style={styles.preview} numberOfLines={1} ellipsizeMode="tail">
                  {previewText}
                </Text>
              ) : null}
            </View>
            <View style={styles.separator} />
          </Pressable>
        </Link.Trigger>

        <Link.Preview style={staticStyles.previewCard}>
          <ArtifactPreviewCard kind={item.kind} preview={item.preview} title={primaryText} />
        </Link.Preview>

        <Link.Menu title={primaryText}>
          {item.kind === 'note' ? (
            <Link.MenuAction destructive icon="trash" onPress={handleDelete}>
              {t.workspace.item.deleteNote.confirm}
            </Link.MenuAction>
          ) : (
            <Link.MenuAction destructive icon="archivebox" onPress={handleArchive}>
              {t.workspace.item.archive}
            </Link.MenuAction>
          )}
        </Link.Menu>
      </Link>
    </Reanimated.View>
  );
});

InboxStreamItem.displayName = 'InboxStreamItem';

function cleanText(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

const useStyles = makeStyles((theme) => ({
  row: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: theme.colors['bg-base'],
  },
  rowPressed: {
    backgroundColor: theme.colors['bg-surface'],
  },
  rowPending: {
    opacity: 0.45,
  },
  body: {
    paddingBottom: 12,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    color: theme.colors.foreground,
    fontSize: fontSizes.md,
    fontFamily: fontFamiliesNative.primary,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.body,
    letterSpacing: -0.1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  time: {
    color: theme.colors['text-tertiary'],
    fontSize: fontSizes.xs,
    fontFamily: fontFamiliesNative.primary,
    lineHeight: lineHeights.caption,
  },
  preview: {
    color: theme.colors['text-secondary'],
    fontSize: fontSizes.sm,
    fontFamily: fontFamiliesNative.primary,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.bodySm,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors['border-faint'],
    marginLeft: 0,
  },
}));

const staticStyles = StyleSheet.create({
  previewCard: {
    width: 320,
  },
});
