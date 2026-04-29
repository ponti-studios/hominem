import { Button, ContextMenu, Host } from '@expo/ui/swift-ui';
import { parseInboxTimestamp } from '@hominem/chat';
import { useRouter } from 'expo-router/build/hooks';
import React, { memo, useCallback } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Reanimated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text, makeStyles, spacing } from '~/components/theme';
import { useChatArchive } from '~/services/chat/use-chat-archive';
import { useNoteDelete } from '~/services/notes/use-note-delete';
import t from '~/translations';

import type { InboxStreamItemData as InboxStreamItemModel } from './InboxStreamItem.types';

// Exit animation duration
const EXIT_MS = 260;

interface InboxStreamItemProps {
  item: InboxStreamItemModel;
}

export const InboxStreamItem = memo(({ item }: InboxStreamItemProps) => {
  const router = useRouter();
  const styles = useStyles();
  const title = item.title ?? item.preview ?? t.workspace.item.untitled;

  // ── Animation shared values ────────────────────────────────────────────────
  const exitProgress = useSharedValue(0);

  const animateExit = useCallback(
    (onComplete: () => void) => {
      exitProgress.value = withTiming(
        1,
        { duration: EXIT_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) scheduleOnRN(onComplete);
        },
      );
    },
    [exitProgress],
  );

  const { mutate: deleteNote } = useNoteDelete({ noteId: item.entityId });
  const { mutate: archiveChat } = useChatArchive({ chatId: item.entityId });

  const handleDelete = useCallback(() => {
    Alert.alert(t.workspace.item.deleteNote.title, t.workspace.item.deleteNote.message, [
      { text: t.workspace.item.deleteNote.cancel, style: 'cancel' },
      {
        text: t.workspace.item.deleteNote.confirm,
        style: 'destructive',
        onPress: () => {
          animateExit(deleteNote);
        },
      },
    ]);
  }, [animateExit, deleteNote]);

  const handleArchive = useCallback(() => {
    animateExit(archiveChat);
  }, [animateExit, archiveChat]);

  // ── Animated styles ────────────────────────────────────────────────────────
  // Merging entering + exit onto one wrapper drops a layout node per row.
  const exitStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exitProgress.value, [0, 0.5, 1], [1, 0.6, 0]),
    transform: [{ translateX: interpolate(exitProgress.value, [0, 1], [0, 40]) }],
  }));

  // ── Handlers ──────────────────────────────────────────────────────────────
  const onPress = useCallback(() => {
    router.push(item.route);
  }, [item.route, router]);

  return (
    <>
      <Reanimated.View entering={FadeIn.duration(200)}>
        <Reanimated.View style={exitStyle} pointerEvents="box-none">
          <Host style={{ width: '100%' }}>
            <ContextMenu>
              <ContextMenu.Trigger>
                <Pressable onPress={onPress}>
                  <View style={styles.row}>
                    <View style={styles.content}>
                      <View style={styles.topRow}>
                        <Text style={styles.title} numberOfLines={1}>
                          {title}
                        </Text>
                        <Text style={styles.date}>{formatTimestamp(item.updatedAt)}</Text>
                      </View>
                    </View>
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
      </Reanimated.View>
    </>
  );
});

InboxStreamItem.displayName = 'InboxStreamItem';

function formatTimestamp(value: string): string {
  try {
    const date = parseInboxTimestamp(value);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayDiff = Math.round((today.getTime() - targetDay.getTime()) / 86400000);

    if (dayDiff === 0) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    if (dayDiff === 1) {
      return t.workspace.item.yesterday;
    }
    if (dayDiff > 1 && dayDiff < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const useStyles = makeStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  content: {
    flex: 1,
    gap: spacing[1],
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    color: theme.colors.foreground,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  date: {
    color: theme.colors['text-tertiary'],
    flexShrink: 0,
    fontSize: 12,
  },
}));
