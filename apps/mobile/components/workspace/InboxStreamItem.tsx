import { Button, ContextMenu, Host } from '@expo/ui/swift-ui';
import { fontFamilies } from '@hominem/ui/tokens';
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

// Exit animation duration
const EXIT_MS = 260;

interface InboxStreamItemProps {
  item: InboxStreamItemModel;
}

export const InboxStreamItem = memo(({ item }: InboxStreamItemProps) => {
  const router = useRouter();
  const styles = useStyles();
  const primaryText = cleanText(item.title) ?? t.workspace.item.untitled;
  const kindLabel = item.kind === 'chat' ? 'CHAT' : 'NOTE';
  const iconName = item.kind === 'chat' ? 'bubble.left' : 'note.text';

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
                <Pressable
                  accessibilityLabel={`${primaryText}, ${kindLabel}`}
                  accessibilityRole="button"
                  onPress={onPress}
                  style={({ pressed }) => [styles.pressable, pressed ? styles.pressed : null]}
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
      </Reanimated.View>
    </>
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
