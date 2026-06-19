import { Link } from 'expo-router';
import React, { memo, useCallback } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';

import {
  Text,
  fontFamiliesNative,
  fontSizes,
  fontWeights,
  lineHeights,
  makeStyles,
  theme,
} from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { useChatArchive } from '~/services/chat/use-chat-archive';
import { useNoteDelete } from '~/services/notes/use-note-delete';
import t from '~/translations';

import { ArtifactPreviewCard } from './ArtifactPreviewCard';
import type { InboxStreamItemData as InboxStreamItemModel } from './InboxStreamItem.types';

interface InboxStreamItemProps {
  item: InboxStreamItemModel;
}

export const InboxStreamItem = memo(({ item }: InboxStreamItemProps) => {
  const styles = useStyles();
  const primaryText = cleanText(item.title) ?? t.workspace.item.untitled;
  const kindLabel = item.kind === 'chat' ? 'CHAT' : 'NOTE';
  const iconName = item.kind === 'chat' ? 'bubble.left' : 'note.text';
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
      {
        text: t.workspace.item.deleteNote.confirm,
        style: 'destructive',
        onPress: () => {
          deleteNote();
        },
      },
    ]);
  }, [deleteNote]);

  const handleArchive = useCallback(() => {
    archiveChat();
  }, [archiveChat]);

  return (
    <Reanimated.View entering={FadeIn.duration(200)}>
      <Link href={item.route} disabled={isPending}>
        <Link.Trigger withAppleZoom>
          <Pressable
            accessibilityLabel={`${primaryText}, ${kindLabel}`}
            accessibilityRole="button"
            disabled={isPending}
            style={({ pressed }) => [
              styles.pressable,
              pressed ? styles.pressed : null,
              isPending ? styles.pending : null,
            ]}
          >
            <View style={styles.row}>
              <AppIcon name={iconName} size={18} tintColor={theme.colors['icon-muted']} />
              <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                {primaryText}
              </Text>
            </View>
          </Pressable>
        </Link.Trigger>
        <Link.Preview style={styles.preview}>
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
  pressable: {},
  pressed: {
    backgroundColor: theme.colors['bg-base'],
  },
  pending: {
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: theme.spacing.md,
    minHeight: 56,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomColor: theme.colors['border-faint'],
    borderBottomWidth: 1,
  },
  content: {
    flex: 1,
    gap: theme.spacing.sm,
    justifyContent: 'center',
    minWidth: 0,
  },
  title: {
    color: theme.colors.foreground,
    flex: 1,
    fontSize: fontSizes.sm,
    fontFamily: fontFamiliesNative.primary,
    letterSpacing: 0,
    lineHeight: lineHeights.bodySm,
    fontWeight: fontWeights.semibold,
  },
  preview: {
    width: 320,
  },
}));
