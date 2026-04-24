import { parseInboxTimestamp } from '@hominem/chat';
import { useApiClient } from '@hominem/rpc/react';
import type { Note } from '@hominem/rpc/types';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { memo, useCallback, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Reanimated, {
  Easing,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text, makeStyles, theme } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import type { ChatWithActivity } from '~/services/chat/session-types';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { chatKeys, noteKeys } from '~/services/notes/query-keys';

import type { InboxStreamItemData as InboxStreamItemModel } from './InboxStreamItem.types';

// Must match delayLongPress on <Pressable>
const LONG_PRESS_MS = 400;

// Exit animation duration
const EXIT_MS = 260;

interface InboxStreamItemProps {
  item: InboxStreamItemModel;
}

export const InboxStreamItem = memo(({ item }: InboxStreamItemProps) => {
  const styles = useStyles();
  const router = useRouter();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { requestTopReveal } = useTopAnchoredFeed();
  const iconColor = item.kind === 'note' ? theme.colors.foreground : theme.colors['text-secondary'];

  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const renameValueRef = useRef(item.title ?? '');

  // ── Shared values ──────────────────────────────────────────────────────────
  // 0 = idle → 1 = fully held (charges over LONG_PRESS_MS)
  const pressProgress = useSharedValue(0);
  // 0 = visible → 1 = gone (plays on archive / delete)
  const exitProgress = useSharedValue(0);

  // ── Press animation ────────────────────────────────────────────────────────
  const handlePressIn = useCallback(() => {
    pressProgress.value = withTiming(1, { duration: LONG_PRESS_MS, easing: Easing.linear });
  }, [pressProgress]);

  const handlePressOut = useCallback(() => {
    pressProgress.value = withSpring(0, { damping: 20, stiffness: 300, mass: 0.8 });
  }, [pressProgress]);

  // Row sinks in as you hold — scale down + subtle tint
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressProgress.value, [0, 1], [1, 0.972]) }],
  }));

  // ── Exit animation (archive / delete) ─────────────────────────────────────
  // Slides right and fades — like filing something away
  const exitStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exitProgress.value, [0, 0.5, 1], [1, 0.6, 0]),
    transform: [{ translateX: interpolate(exitProgress.value, [0, 1], [0, 40]) }],
  }));

  const animateExit = useCallback(
    (onComplete: () => void) => {
      exitProgress.value = withTiming(
        1,
        { duration: EXIT_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onComplete)();
        },
      );
    },
    [exitProgress],
  );

  // ── Navigation ─────────────────────────────────────────────────────────────
  const onPress = useCallback(() => {
    router.push(item.route as RelativePathString);
  }, [item.route, router]);

  // ── Note actions ──────────────────────────────────────────────────────────
  const commitRename = useCallback(
    async (newTitle: string) => {
      const trimmed = newTitle.trim();
      const res = await client.api.notes[':id'].$patch({
        param: { id: item.entityId },
        json: { title: trimmed.length > 0 ? trimmed : null },
      });
      const updatedNote = await res.json();
      queryClient.setQueryData<Note>(noteKeys.detail(item.entityId), updatedNote);
      queryClient.setQueryData<Note[]>(noteKeys.all, (current) =>
        current?.map((n) => (n.id === item.entityId ? updatedNote : n)),
      );
      requestTopReveal();
      void queryClient.invalidateQueries({ queryKey: noteKeys.feeds() });
    },
    [client, item.entityId, queryClient, requestTopReveal],
  );

  const handleRenameNote = useCallback(() => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Rename note',
        undefined,
        async (newTitle) => {
          if (newTitle === null) return;
          await commitRename(newTitle);
        },
        'plain-text',
        item.title ?? '',
      );
    } else {
      renameValueRef.current = item.title ?? '';
      setRenameModalVisible(true);
    }
  }, [commitRename, item.title]);

  const handleDeleteNote = useCallback(() => {
    Alert.alert('Delete note', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          animateExit(async () => {
            await client.api.notes[':id'].$delete({ param: { id: item.entityId } });
            queryClient.setQueryData<Note[]>(noteKeys.all, (current) =>
              current?.filter((n) => n.id !== item.entityId),
            );
            void queryClient.invalidateQueries({ queryKey: noteKeys.feeds() });
          });
        },
      },
    ]);
  }, [animateExit, client, item.entityId, queryClient]);

  // ── Chat actions ──────────────────────────────────────────────────────────
  const handleArchiveChat = useCallback(() => {
    Alert.alert('Archive chat', 'This chat will be moved to your archive.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: () => {
          animateExit(async () => {
            await client.api.chats[':id'].archive.$post({ param: { id: item.entityId } });
            queryClient.setQueryData<ChatWithActivity[]>(chatKeys.resumableSessions, (current) =>
              current?.filter((c) => c.id !== item.entityId),
            );
          });
        },
      },
    ]);
  }, [animateExit, client, item.entityId, queryClient]);

  // ── Long-press handler ────────────────────────────────────────────────────
  const onLongPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (item.kind === 'note') {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Rename', 'Delete'],
            destructiveButtonIndex: 2,
            cancelButtonIndex: 0,
          },
          (index) => {
            if (index === 1) handleRenameNote();
            if (index === 2) handleDeleteNote();
          },
        );
      } else {
        Alert.alert(item.title ?? 'Note', undefined, [
          { text: 'Rename', onPress: handleRenameNote },
          { text: 'Delete', style: 'destructive', onPress: handleDeleteNote },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    } else {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Cancel', 'Archive'], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
          (index) => {
            if (index === 1) handleArchiveChat();
          },
        );
      } else {
        Alert.alert(item.title ?? 'Chat', undefined, [
          { text: 'Archive', style: 'destructive', onPress: handleArchiveChat },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    }
  }, [item.kind, item.title, handleRenameNote, handleDeleteNote, handleArchiveChat]);

  const label = item.title ?? item.preview ?? 'Untitled';
  const hasTitle = Boolean(item.title);

  return (
    <Reanimated.View entering={FadeIn.duration(200)}>
      <Reanimated.View style={exitStyle}>
        <Reanimated.View style={pressStyle}>
          <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            delayLongPress={LONG_PRESS_MS}
          >
            <View style={styles.rowInner}>
              <View
                style={[
                  styles.leading,
                  item.kind === 'note' ? styles.noteLeading : styles.chatLeading,
                ]}
              >
                <AppIcon
                  name={item.kind === 'note' ? 'square.and.pencil' : 'bubble.left'}
                  size={11}
                  color={iconColor}
                />
              </View>
              <Text
                numberOfLines={1}
                variant="body"
                color="foreground"
                style={[styles.label, !hasTitle && styles.labelUntitled]}
              >
                {label}
              </Text>
              <Text numberOfLines={1} style={styles.metadata}>
                {formatTimestamp(item.updatedAt)}
              </Text>
            </View>
          </Pressable>
        </Reanimated.View>
      </Reanimated.View>

      {Platform.OS !== 'ios' && (
        <Modal
          transparent
          animationType="fade"
          visible={renameModalVisible}
          onRequestClose={() => setRenameModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text variant="body" color="foreground" style={styles.modalTitle}>
                Rename note
              </Text>
              <TextInput
                style={styles.modalInput}
                defaultValue={item.title ?? ''}
                onChangeText={(text) => {
                  renameValueRef.current = text;
                }}
                autoFocus
                returnKeyType="done"
                accessibilityLabel="Note title"
                accessibilityHint="Enter a new title for the note"
                onSubmitEditing={() => {
                  setRenameModalVisible(false);
                  void commitRename(renameValueRef.current);
                }}
              />
              <View style={styles.modalActions}>
                <Pressable style={styles.modalButton} onPress={() => setRenameModalVisible(false)}>
                  <Text variant="body" color="text-secondary">
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.modalButton}
                  onPress={() => {
                    setRenameModalVisible(false);
                    void commitRename(renameValueRef.current);
                  }}
                >
                  <Text variant="body" color="foreground">
                    Rename
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Reanimated.View>
  );
});

InboxStreamItem.displayName = 'InboxStreamItem';

function toDate(value: string): Date {
  return parseInboxTimestamp(value);
}

function formatTimestamp(value: string): string {
  const date = toDate(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((today.getTime() - targetDay.getTime()) / 86400000);

  if (dayDiff === 0) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  if (dayDiff === 1) {
    return 'Yesterday';
  }

  if (dayDiff > 1 && dayDiff < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    rowInner: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: t.spacing.sm_8,
      paddingHorizontal: t.spacing.m_16,
      paddingVertical: 14,
    },
    leading: {
      alignItems: 'center',
      flexShrink: 0,
      height: 18,
      justifyContent: 'center',
      marginTop: 1,
      width: 18,
    },
    noteLeading: {
      backgroundColor: 'transparent',
    },
    chatLeading: {
      backgroundColor: 'transparent',
    },
    // Editorial title — medium weight, tight tracking
    label: {
      color: t.colors.foreground,
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      letterSpacing: -0.4,
      lineHeight: 20,
    },
    labelUntitled: {
      color: t.colors['text-secondary'],
      fontWeight: '400',
    },
    // Editorial dateline — uppercase, tracked out, no extra opacity
    metadata: {
      color: t.colors['text-tertiary'],
      flexShrink: 0,
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 0.5,
      lineHeight: 14,
      textTransform: 'uppercase',
    },
    modalOverlay: {
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      flex: 1,
      justifyContent: 'center',
    },
    modalContainer: {
      borderRadius: 12,
      gap: t.spacing.sm_12,
      padding: t.spacing.m_16,
      width: '80%',
    },
    modalTitle: {
      fontWeight: '600',
      textAlign: 'center',
    },
    modalInput: {
      borderColor: t.colors['border-faint'],
      borderRadius: 8,
      borderWidth: 1,
      color: t.colors.foreground,
      fontSize: 15,
      paddingHorizontal: t.spacing.sm_12,
      paddingVertical: t.spacing.sm_8,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: t.spacing.m_16,
    },
    modalButton: {
      paddingVertical: t.spacing.sm_8,
    },
  }),
);
