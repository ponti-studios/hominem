import { Link } from 'expo-router';
import React, { memo, useCallback } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Reanimated, { Easing, FadeIn } from 'react-native-reanimated';

import {
  Text,
  fontFamiliesNative,
  fontSizes,
  lineHeights,
  makeStyles,
} from '~/components/theme';
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
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                {primaryText}
              </Text>
              <View style={styles.meta}>
                <Text style={styles.time}>{timeAgo}</Text>
              </View>
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
    paddingTop: 6,
    backgroundColor: theme.colors['bg-base'],
  },
  rowPressed: {
    backgroundColor: theme.colors['bg-surface'],
  },
  rowPending: {
    opacity: 0.45,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 42,
    paddingBottom: 6,
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
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  time: {
    color: theme.colors['text-tertiary'],
    fontSize: fontSizes.sm,
    fontFamily: fontFamiliesNative.primary,
    lineHeight: lineHeights.caption,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors['border-faint'],
    marginLeft: 2,
  },
}));

const staticStyles = StyleSheet.create({
  previewCard: {
    width: 320,
  },
});
