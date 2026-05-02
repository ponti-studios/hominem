import { radii, spacing } from '@hominem/ui/tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { KeyboardStickyView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles } from '~/components/theme';
import { createLayoutTransition } from '~/components/theme/animations';
import { BlurSurface } from '~/components/ui/BlurSurface';
import { useReducedMotion } from '~/hooks/use-reduced-motion';

const KEYBOARD_OPEN_OVERLAP = spacing[3];
const KEYBOARD_OPEN_PADDING_BOTTOM = spacing[5];
const KEYBOARD_CLOSED_OFFSET = -KEYBOARD_OPEN_OVERLAP;

interface ComposerToolbarProps {
  accessory?: React.ReactNode;
  actions?: React.ReactNode;
  input: React.ReactNode;
  leadingAction: React.ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ComposerToolbar: React.FC<ComposerToolbarProps> = ({
  accessory,
  actions,
  input,
  leadingAction,
  onLayout,
  style,
  testID,
}) => {
  const styles = useStyles();
  const prefersReducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { progress } = useReanimatedKeyboardAnimation();

  const contentStyle = useAnimatedStyle(() => ({
    paddingBottom: interpolate(
      progress.value,
      [0, 1],
      [
        Math.max(Math.min(insets.bottom, spacing[5]), spacing[3]),
        KEYBOARD_OPEN_PADDING_BOTTOM,
      ],
    ),
  }));

  return (
    <KeyboardStickyView
      offset={{ closed: KEYBOARD_CLOSED_OFFSET, opened: 0 }}
      style={[styles.container, style]}
    >
      <Animated.View
        layout={createLayoutTransition(prefersReducedMotion)}
        onLayout={onLayout}
        style={styles.surface}
        testID={testID}
      >
        <BlurSurface tint="chrome" style={styles.blur}>
          <Animated.View style={[styles.content, contentStyle]}>
            {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
            <View style={styles.inputWell}>
              <View style={styles.inputSlot}>{input}</View>
            </View>
            <View style={[styles.actionRow, actions ? null : styles.actionRowCompact]}>
              <View style={styles.leadingActionSlot}>{leadingAction}</View>
              <View style={styles.actionSlot}>{actions}</View>
            </View>
          </Animated.View>
        </BlurSurface>
      </Animated.View>
    </KeyboardStickyView>
  );
};

const useStyles = makeStyles((theme) => ({
  container: {
    left: 0,
    position: 'absolute',
    right: 0,
    bottom: -KEYBOARD_OPEN_OVERLAP,
  },
  surface: {
    borderTopColor: theme.colors['border-subtle'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radii.sm,
    borderTopRightRadius: radii.sm,
    overflow: 'hidden',
    width: '100%',
  },
  blur: {
    borderTopLeftRadius: radii.sm,
    borderTopRightRadius: radii.sm,
    overflow: 'hidden',
    width: '100%',
  },
  content: {
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingTop: spacing[1],
  },
  accessory: {
    gap: spacing[2],
    width: '100%',
  },
  inputWell: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    width: '100%',
  },
  inputSlot: {
    flex: 1,
    minWidth: 0,
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: spacing[5],
    marginTop: 0,
    width: '100%',
  },
  actionRowCompact: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
    marginTop: 0,
    minHeight: 0,
    width: 'auto',
  },
  leadingActionSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSlot: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
}));
