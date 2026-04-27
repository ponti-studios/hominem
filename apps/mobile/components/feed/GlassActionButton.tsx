import { spacing } from '@hominem/ui/tokens';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useThemeColors } from '~/components/theme/theme';
import AppIcon from '~/components/ui/icon';

// ── Constants ─────────────────────────────────────────────────────────────────

const BTN = spacing[6]; // 32px
const ICON = spacing[4] + 2; // 18px
const GAP = spacing[2]; // 8px
const REVEAL_Y = -(BTN + GAP); // -40px — position of chat option above main button
const THRESHOLD = REVEAL_Y * 0.55; // ≈ -22px — drag past here to select chat

// ── Component ─────────────────────────────────────────────────────────────────

interface GlassActionButtonProps {
  onSave: () => void;
  onChat: () => void;
  disabled?: boolean;
}

export function GlassActionButton({ onSave, onChat, disabled = false }: GlassActionButtonProps) {
  const themeColors = useThemeColors();
  const isDark = useColorScheme() === 'dark';

  const mainScale = useSharedValue(1);
  const chatVisible = useSharedValue(0);
  const chatActive = useSharedValue(0);

  const triggerImpact = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const triggerSelection = () => void Haptics.selectionAsync();

  // Quick tap → save
  const tapGesture = Gesture.Tap()
    .maxDuration(300)
    .enabled(!disabled)
    .onEnd(() => {
      scheduleOnRN(onSave);
    });

  // Hold (280ms) → reveal chat option; drag up past threshold → select chat
  const panGesture = Gesture.Pan()
    .activateAfterLongPress(280)
    .enabled(!disabled)
    .onStart(() => {
      mainScale.value = withSpring(0.9, { damping: 18, stiffness: 300 });
      chatVisible.value = withSpring(1, { damping: 16, stiffness: 260 });
      scheduleOnRN(triggerImpact);
    })
    .onUpdate(({ translationY }) => {
      const wasActive = chatActive.value > 0.5;
      const isNowActive = translationY <= THRESHOLD;
      if (isNowActive !== wasActive) {
        chatActive.value = withTiming(isNowActive ? 1 : 0, { duration: 120 });
        scheduleOnRN(triggerSelection);
      }
    })
    .onEnd(({ translationY }) => {
      if (translationY <= THRESHOLD) {
        scheduleOnRN(onChat);
      } else {
        scheduleOnRN(onSave);
      }
    })
    .onFinalize(() => {
      mainScale.value = withSpring(1, { damping: 18, stiffness: 300 });
      chatVisible.value = withSpring(0, { damping: 18, stiffness: 300 });
      chatActive.value = withTiming(0, { duration: 100 });
    });

  const race = Gesture.Race(tapGesture, panGesture);

  const mainStyle = useAnimatedStyle(() => ({
    transform: [{ scale: mainScale.value }],
  }));

  const chatStyle = useAnimatedStyle(() => ({
    opacity: chatVisible.value,
    transform: [
      { scale: interpolate(chatVisible.value, [0, 1], [0.55, 1]) },
      { translateY: interpolate(chatVisible.value, [0, 1], [6, 0]) },
    ],
  }));

  const chatOverlayStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      chatActive.value,
      [0, 1],
      isDark
        ? ['rgba(255,255,255,0.08)', 'rgba(96,165,250,0.22)']
        : ['rgba(0,0,0,0.04)', 'rgba(59,130,246,0.18)'],
    ),
  }));

  const borderColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
  const mainOverlayColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const iconColor = disabled ? themeColors['text-tertiary'] : '#ffffff';
  const blurTint = isDark ? ('dark' as const) : ('light' as const);

  return (
    <GestureDetector gesture={race}>
      <Animated.View style={styles.wrapper}>
        {/* Chat option — floats above, revealed on hold */}
        <Animated.View
          style={[styles.floatingBtn, { borderColor }, chatStyle]}
          pointerEvents="none"
        >
          <BlurView intensity={28} tint={blurTint} style={StyleSheet.absoluteFill} />
          <Animated.View style={[StyleSheet.absoluteFill, chatOverlayStyle]} />
          <Animated.View style={styles.specHighlight} />
          <AppIcon name="bubble.left" size={ICON} color={themeColors['text-secondary']} />
        </Animated.View>

        {/* Main save button */}
        <Animated.View style={[styles.mainBtn, { borderColor }, mainStyle]}>
          {disabled ? (
            <>
              <BlurView intensity={28} tint={blurTint} style={StyleSheet.absoluteFill} />
              <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: mainOverlayColor }]} />
              <Animated.View style={styles.specHighlight} />
            </>
          ) : (
            <Animated.View style={[StyleSheet.absoluteFill, styles.mainBtnActive]} />
          )}
          <AppIcon name="arrow.up" size={ICON} color={iconColor} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    width: BTN,
    height: BTN,
    // overflow is intentionally NOT set (defaults to visible) so the
    // chat option can float above the card bounds
  },
  floatingBtn: {
    position: 'absolute',
    top: REVEAL_Y,
    left: 0,
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainBtn: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainBtnActive: {
    backgroundColor: '#000000',
  },
  specHighlight: {
    position: 'absolute',
    top: 2,
    left: '15%',
    right: '15%',
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    pointerEvents: 'none',
  },
});
