import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '~/components/theme';
import { Glass } from '~/components/ui/glass';
import AppIcon from '~/components/ui/icon';
import { PressableScale } from '~/components/ui/pressable-scale';

// The tab screens' content ends above the screen's bottom edge, where the native
// tab bar starts. Measured from that edge, the trigger sits level with the bar's
// centre; this offset converts that to the content's bottom edge.
const CONTENT_BOTTOM_GAP = 95;
// Level with the bar's centre: the button is 52pt, so its bottom edge sits 24pt above the screen's.
const TAB_ROW_BOTTOM = 24 - CONTENT_BOTTOM_GAP;
// The strip beside the bar is only about 63pt wide on this phone. A 52pt button leaves
// about 5pt to the bar and about 6pt to the screen edge, so it takes the content's inset back.
const TAB_ROW_RIGHT = -5;
const BUTTON_SIZE = 52;

// Opening is the longer move (the person is deciding to write); closing is quicker.
// Both use a strong ease-out, so neither starts slow and neither bounces.
const OPEN_MS = 240;
const CLOSE_MS = 160;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// The composer rises from below the screen's bottom edge, so it is off-screen
// before it starts. Only transforms move it: its glass must stay at full opacity
// (see glass.tsx), so it never fades. The small scale is a transform too.
const SLIDE_FROM_PX = 420;
const START_SCALE = 0.98;

interface ComposerRevealProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  // What the button says to VoiceOver when closed, e.g. "New message" or "New task".
  openLabel: string;
  testID?: string;
  children: ReactNode;
}

// The composer is folded away until asked for. One glass button sits beside the
// tab bar; its icon turns from a pencil into a close X. A single progress value
// drives the composer and the icon, so a reversal mid-motion retargets from where
// it is instead of snapping. Reduce Motion drops the travel and shows it at once.
export function ComposerReveal({
  open,
  onOpen,
  onClose,
  openLabel,
  testID,
  children,
}: ComposerRevealProps) {
  const { primary, primaryForeground } = useAppTheme().colors;
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(open ? 1 : 0);
  // The composer is only in the tree while it is (or is becoming) visible.
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
    }
    if (reduceMotion) {
      // No travel: the composer simply appears and disappears.
      progress.value = open ? 1 : 0;
      if (!open) {
        setMounted(false);
      }
      return;
    }
    progress.value = withTiming(
      open ? 1 : 0,
      { duration: open ? OPEN_MS : CLOSE_MS, easing: EASE_OUT },
      (finished) => {
        // A reopen mid-close cancels this callback (finished is false), so the composer stays up.
        if (finished && !open) {
          runOnJS(setMounted)(false);
        }
      },
    );
  }, [open, progress, reduceMotion]);

  const composerStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [
        { translateY: interpolate(p, [0, 1], [SLIDE_FROM_PX, 0]) },
        { scale: interpolate(p, [0, 1], [START_SCALE, 1]) },
      ],
    };
  });

  const pencilStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: 1 - p,
      transform: [{ rotate: `${reduceMotion ? 0 : interpolate(p, [0, 1], [0, 90])}deg` }],
    };
  });

  const closeIconStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p,
      transform: [{ rotate: `${reduceMotion ? 0 : interpolate(p, [0, 1], [-90, 0])}deg` }],
    };
  });

  return (
    <>
      {mounted ? <Animated.View style={composerStyle}>{children}</Animated.View> : null}
      <View pointerEvents="box-none" style={styles.tabRowSlot}>
        <PressableScale
          accessibilityLabel={open ? 'Close' : openLabel}
          accessibilityRole="button"
          onPress={open ? onClose : onOpen}
          style={styles.button}
          testID={testID ? `${testID}-button` : undefined}
        >
          {/* Primary-tinted glass, the same colour as the send button, so the one
              action in the row reads as the main one. */}
          <Glass interactive style={styles.fill} tint={primary}>
            <View style={styles.iconStack}>
              <Animated.View style={[styles.icon, pencilStyle]}>
                <AppIcon name="square.and.pencil" size={20} tintColor={primaryForeground} />
              </Animated.View>
              <Animated.View style={[styles.icon, closeIconStyle]}>
                <AppIcon name="xmark" size={16} tintColor={primaryForeground} />
              </Animated.View>
            </View>
          </Glass>
        </PressableScale>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  tabRowSlot: { bottom: TAB_ROW_BOTTOM, position: 'absolute', right: TAB_ROW_RIGHT },
  button: { height: BUTTON_SIZE, width: BUTTON_SIZE },
  fill: {
    alignItems: 'center',
    height: BUTTON_SIZE,
    justifyContent: 'center',
    width: BUTTON_SIZE,
  },
  // Both icons share one fixed box, so flipping pencil to X never shifts the button.
  iconStack: { alignItems: 'center', height: 22, justifyContent: 'center', width: 22 },
  icon: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
});
