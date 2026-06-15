import { Button, ContextMenu, Host } from '@expo/ui/swift-ui';
import { useRouter } from 'expo-router';
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

import type { InboxStreamItemData as InboxStreamItemModel } from './InboxStreamItem.types';

interface InboxStreamItemProps {
  item: InboxStreamItemModel;
}

export const InboxStreamItem = memo(({ item }: InboxStreamItemProps) => {
  const router = useRouter();
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

  const onPress = useCallback(() => {
    if (isPending) {
      return;
    }

    router.push(item.route);
  }, [isPending, item.route, router]);

  return (
    <Reanimated.View entering={FadeIn.duration(200)}>
      <Host style={{ width: '100%' }}>
        <ContextMenu>
          <ContextMenu.Trigger>
            <Pressable
              accessibilityLabel={`${primaryText}, ${kindLabel}`}
              accessibilityRole="button"
              disabled={isPending}
              onPress={onPress}
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
          </ContextMenu.Trigger>
          <ContextMenu.Items>
            {item.kind === 'note' ? (
              <Button
                label={t.workspace.item.deleteNote.confirm}
                role="destructive"
                systemImage="trash"
                onPress={handleDelete}
              />
            ) : (
              <Button
                label={t.workspace.item.archive}
                role="destructive"
                systemImage="archivebox"
                onPress={handleArchive}
              />
            )}
          </ContextMenu.Items>
        </ContextMenu>
      </Host>
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
}));
