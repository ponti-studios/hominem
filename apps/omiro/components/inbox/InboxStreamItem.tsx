import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type WithTimingConfig,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { fontFamilies, useAppTheme, useStyles } from '~/components/theme';
import { ListRow } from '~/components/ui';
import AppIcon from '~/components/ui/icon';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { useChatArchive } from '~/services/chat/use-chat-archive';
import { nativeMotionTiming } from '~/services/motion/native-motion';
import { useNoteDelete } from '~/services/notes/use-note-delete';
import t from '~/translations';

import type { InboxStreamItemData } from './InboxStreamItem.types';
import { stripPreviewMarkdown } from './strip-preview-markdown';

interface InboxStreamItemProps {
  isNew?: boolean;
  item: InboxStreamItemData;
}

// Width of the revealed swipe action button, and how far past it a fast/far
// swipe must travel to auto-commit without a second tap (iOS Mail-style).
const ACTION_WIDTH = 88;
const COMMIT_DISTANCE = 160;
const COMMIT_VELOCITY = 900;
const REVEAL_VELOCITY = 500;

// How far the row continues off-screen once the action is committed, so the
// swipe motion and the row's removal read as one continuous gesture rather
// than a drag followed by a separate exit animation.
const EXIT_FLY_DISTANCE = 400;

const EXIT_COMMIT_DELAY_MS = nativeMotionTiming.exit.duration + 10;

// How rounded the row's trailing corners get, and how dark the scrim over
// the icon+title gets, once the swipe has traveled the full reveal width --
// both interpolate directly off `dragX`, so closing the swipe (dragX
// animating back to 0 or snapping there when the gesture is abandoned)
// reverses them for free instead of needing a separate close animation.
const SWIPE_CORNER_RADIUS = 16;
const SWIPE_DARKEN_OPACITY = 0.18;

// iOS drops a new Alert.alert presented synchronously from inside another
// alert's button onPress -- the second alert races the first alert's dismiss
// animation and intermittently never appears (observed repeatedly in the
// Maestro delete flow: swipe a row, tap Delete, and the "Delete note"
// confirmation is sometimes missing entirely). Defer the confirmation until
// the dismissal has settled. Long enough to clear the ~300ms dismiss
// animation, short enough to feel immediate.
const ALERT_CONFIRM_DEFER_MS = 350;

// Ensure that title + icon share same height for vertical alignment
const TITLE_LINE_HEIGHT = 22;

function instantOr(config: WithTimingConfig, reducedMotion: boolean): WithTimingConfig {
  'worklet';
  return reducedMotion ? { duration: 0 } : config;
}

export const InboxStreamItem = memo(({ isNew = false, item }: InboxStreamItemProps) => {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const titleText = cleanText(item.title);
  const previewText = cleanText(item.preview ? stripPreviewMarkdown(item.preview) : item.preview);
  const primaryText = titleText ?? previewText ?? t.inbox.item.untitled;
  const isChat = item.kind === 'chat';
  const { destructive, destructiveForeground, mutedForeground, primary, primaryForeground } =
    useAppTheme().colors;
  const styles = useStyles((theme) => ({
    // Opaque -- without a real background here the row is transparent
    // everywhere except glyph pixels, so the revealed archive/delete panel
    // (which fades in by opacity alone, not by how far the row has slid)
    // bleeds straight through the icon+title area the instant a swipe
    // starts, not just in the strip actually uncovered by the drag.
    row: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.lg,
    },
    wrapper: { position: 'relative', overflow: 'hidden' },
    // Clips the row's square-cornered background to `dragStyle`'s animated
    // trailing radius, so the peel-back effect actually shows rounded
    // corners instead of a rounded box with a square panel still visible
    // inside it.
    dragSurface: { overflow: 'hidden' },
    swipeScrim: { backgroundColor: '#000' },
    actionPanel: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: ACTION_WIDTH,
    },
    actionButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
    },
    actionLabel: { ...theme.textVariants.caption1, fontWeight: '600' },
    title: {
      fontFamily: fontFamilies.sans,
      fontSize: 17,
      lineHeight: TITLE_LINE_HEIGHT,
    },
    // Aligns the icon to the title's own line instead of the vertical center
    // of the whole title+subtitle block -- a box exactly as tall as the
    // title's line height, with the icon centered inside it, rather than a
    // hand-tuned paddingTop that only happened to line up for one icon size.
    // Pair with `leadingAlign="top"` below so the title+subtitle block is
    // anchored to this same top edge instead of centering as a whole unit.
    leading: {
      height: TITLE_LINE_HEIGHT,
      justifyContent: 'center' as const,
    },
  }));

  const leaving = useSharedValue(1);
  const dragX = useSharedValue(0);
  const startOffset = useSharedValue(0);
  const [isLeaving, setIsLeaving] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { mutate: deleteNote, isPending: isDeletingNote } = useNoteDelete({
    noteId: item.entityId,
  });
  const { mutate: archiveChat, isPending: isArchivingChat } = useChatArchive({
    chatId: item.entityId,
  });
  const isPending = isDeletingNote || isArchivingChat;

  useEffect(
    () => () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
      }
    },
    [],
  );

  // A different item can land in this recycled row (FlashList reuses cells),
  // so any leftover reveal offset from the previous occupant must not show.
  useEffect(() => {
    dragX.value = 0;
  }, [dragX, item.id]);

  const closeSwipe = useCallback(() => {
    dragX.value = withTiming(0, instantOr(nativeMotionTiming.enter, reducedMotion));
  }, [dragX, reducedMotion]);

  // Plays the exit while the row is still mounted, then commits the mutation
  // (whose optimistic cache removal unmounts the now-invisible row).
  const beginExit = useCallback(
    (commit: () => void) => {
      setIsLeaving(true);
      leaving.value = withTiming(0, nativeMotionTiming.exit);
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
      exitTimerRef.current = setTimeout(commit, EXIT_COMMIT_DELAY_MS);
    },
    [leaving],
  );

  // Mutation failed and the cache rolled back, so the row is still in the
  // list -- fade and slide it back in instead of leaving it stuck invisible.
  const cancelExit = useCallback(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    leaving.value = withTiming(1, nativeMotionTiming.enter);
    closeSwipe();
    setIsLeaving(false);
  }, [closeSwipe, leaving]);

  const leavingStyle = useAnimatedStyle(() => ({ opacity: leaving.value }));
  const dragStyle = useAnimatedStyle(() => {
    const radius = interpolate(
      dragX.value,
      [-ACTION_WIDTH, 0],
      [SWIPE_CORNER_RADIUS, 0],
      Extrapolation.CLAMP,
    );
    return {
      borderBottomRightRadius: radius,
      borderTopRightRadius: radius,
      transform: [{ translateX: dragX.value }],
    };
  });
  const swipeScrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      dragX.value,
      [-ACTION_WIDTH, 0],
      [SWIPE_DARKEN_OPACITY, 0],
      Extrapolation.CLAMP,
    ),
  }));
  const actionPanelStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(dragX.value) / ACTION_WIDTH),
  }));

  // Only rows that arrived after the first paint slide in; historical rows,
  // pagination appends, and filter switches mount static.
  //
  // Deliberately no `layout` animation here: FlashList recycles cells and
  // repositions them as you scroll, and a Reanimated layout animation treats
  // each reposition as a layout change to animate -- so the row's text visibly
  // slides from its previous occupant's position to the new one, reading as a
  // flash of overlapping titles. Removal gaps close instantly instead.
  const entering = isNew
    ? reducedMotion
      ? FadeIn.duration(nativeMotionTiming.quick.duration)
      : FadeInDown.duration(nativeMotionTiming.quick.duration)
    : undefined;

  const handleDelete = useCallback(() => {
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
    }
    alertTimerRef.current = setTimeout(() => {
      Alert.alert(t.inbox.item.deleteNote.title, t.inbox.item.deleteNote.message, [
        { text: t.inbox.item.deleteNote.cancel, style: 'cancel', onPress: closeSwipe },
        {
          text: t.inbox.item.deleteNote.confirm,
          style: 'destructive',
          onPress: () => {
            if (isLeaving) {
              return;
            }
            dragX.value = withTiming(
              -EXIT_FLY_DISTANCE,
              instantOr(nativeMotionTiming.exit, reducedMotion),
            );
            beginExit(() => deleteNote(undefined, { onError: cancelExit }));
          },
        },
      ]);
    }, ALERT_CONFIRM_DEFER_MS);
  }, [beginExit, cancelExit, closeSwipe, deleteNote, dragX, isLeaving, reducedMotion]);

  const handleArchive = useCallback(() => {
    if (isLeaving || isPending) {
      return;
    }
    dragX.value = withTiming(-EXIT_FLY_DISTANCE, instantOr(nativeMotionTiming.exit, reducedMotion));
    beginExit(() => archiveChat(undefined, { onError: cancelExit }));
  }, [archiveChat, beginExit, cancelExit, dragX, isLeaving, isPending, reducedMotion]);

  // The revealed action button and an over-swipe both commit the same way;
  // delete keeps its confirmation, archive is immediate (matching the prior
  // long-press menu's behavior).
  const commitAction = useCallback(() => {
    if (isPending || isLeaving) {
      return;
    }
    if (isChat) {
      handleArchive();
      return;
    }
    dragX.value = withTiming(-ACTION_WIDTH, instantOr(nativeMotionTiming.enter, reducedMotion));
    handleDelete();
  }, [dragX, handleArchive, handleDelete, isChat, isLeaving, isPending, reducedMotion]);

  const onOpen = useCallback(() => {
    if (dragX.value !== 0) {
      closeSwipe();
      return;
    }
    router.push(item.route);
  }, [closeSwipe, dragX, item.route, router]);

  const swipe = Gesture.Pan()
    .enabled(!isPending && !isLeaving)
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      'worklet';
      startOffset.value = dragX.value;
    })
    .onUpdate((event) => {
      'worklet';
      const next = startOffset.value + event.translationX;
      dragX.value = Math.min(0, Math.max(next, -ACTION_WIDTH * 1.3));
    })
    .onEnd((event) => {
      'worklet';
      const shouldCommit = dragX.value <= -COMMIT_DISTANCE || event.velocityX <= -COMMIT_VELOCITY;
      if (shouldCommit) {
        scheduleOnRN(commitAction);
        return;
      }
      const shouldReveal = dragX.value <= -ACTION_WIDTH / 2 || event.velocityX <= -REVEAL_VELOCITY;
      dragX.value = withTiming(
        shouldReveal ? -ACTION_WIDTH : 0,
        instantOr(nativeMotionTiming.enter, reducedMotion),
      );
    });

  const handleAccessibilityAction = useCallback(() => {
    if (isChat) {
      handleArchive();
    } else {
      handleDelete();
    }
  }, [handleArchive, handleDelete, isChat]);

  return (
    <Reanimated.View entering={entering} style={leavingStyle} testID={`inbox-item-${item.kind}`}>
      <View style={styles.wrapper}>
        <Reanimated.View
          style={[
            styles.actionPanel,
            { backgroundColor: isChat ? primary : destructive },
            actionPanelStyle,
          ]}
        >
          <Pressable
            accessibilityLabel={isChat ? t.inbox.item.archiveChat : t.inbox.item.deleteNote.menu}
            accessibilityRole="button"
            onPress={commitAction}
            style={styles.actionButton}
            testID={`inbox-item-${isChat ? 'chat' : 'note'}-${isChat ? 'archive' : 'delete'}`}
          >
            <AppIcon
              name={isChat ? 'archivebox' : 'trash'}
              size={20}
              tintColor={isChat ? primaryForeground : destructiveForeground}
            />
            <Text
              style={[
                styles.actionLabel,
                { color: isChat ? primaryForeground : destructiveForeground },
              ]}
            >
              {isChat ? t.inbox.item.archiveChat : t.inbox.item.deleteNote.menu}
            </Text>
          </Pressable>
        </Reanimated.View>
        <GestureDetector gesture={swipe}>
          <Reanimated.View style={[styles.dragSurface, dragStyle]}>
            <ListRow
              accessibilityActions={[
                {
                  name: isChat ? 'archive' : 'delete',
                  label: isChat ? t.inbox.item.archiveChat : t.inbox.item.deleteNote.menu,
                },
              ]}
              accessibilityLabel={primaryText}
              actionTestID={`inbox-item-${isChat ? 'chat' : 'note'}-open`}
              divider={false}
              leading={
                <AppIcon
                  name={isChat ? 'bubble.left' : 'note.text'}
                  size={18}
                  tintColor={mutedForeground}
                />
              }
              leadingAlign="top"
              leadingStyle={styles.leading}
              onAccessibilityAction={handleAccessibilityAction}
              onPress={onOpen}
              style={styles.row}
              title={primaryText}
              titleNumberOfLines={1}
              titleStyle={styles.title}
            />
            <Reanimated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.swipeScrim, swipeScrimStyle]}
            />
          </Reanimated.View>
        </GestureDetector>
      </View>
    </Reanimated.View>
  );
});
InboxStreamItem.displayName = 'InboxStreamItem';

function cleanText(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
