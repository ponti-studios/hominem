import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColorScheme } from 'react-native';
import { spacing } from '@hominem/ui/tokens';

import { makeStyles } from '~/components/theme';
import { createLayoutTransition } from '~/components/theme/animations';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { MAX_WIDTH, PILL_RADIUS } from './useComposerBase';

const PILL_ENTERING = FadeInDown.duration(240).springify().damping(20).stiffness(220).mass(0.9);

interface ComposerPillProps {
  onLayout?: (e: LayoutChangeEvent) => void;
  testID?: string;
  style?: any;
  children: React.ReactNode;
}

export function ComposerPill({ onLayout, testID, style, children }: ComposerPillProps) {
  const isDark = useColorScheme() === 'dark';
  const blurTint = isDark ? ('dark' as const) : ('light' as const);
  const pillOverlayColor = isDark ? 'rgba(30,30,30,0.5)' : 'rgba(255,255,255,0.6)';
  const pillBorderColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';
  const prefersReducedMotion = useReducedMotion();
  const styles = useStyles();

  return (
    <Animated.View
      entering={prefersReducedMotion ? undefined : PILL_ENTERING}
      layout={createLayoutTransition(prefersReducedMotion)}
      onLayout={onLayout}
      style={[styles.pill, { borderColor: pillBorderColor }, style]}
      testID={testID}
    >
      <View style={[StyleSheet.absoluteFill, styles.blurClip]}>
        <BlurView intensity={24} tint={blurTint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: pillOverlayColor }]} />
      </View>
      <View style={styles.specHighlight} pointerEvents="none" />
      {children}
    </Animated.View>
  );
}

const useStyles = makeStyles(() => ({
  pill: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    borderRadius: PILL_RADIUS,
    borderCurve: 'continuous',
    overflow: 'visible',
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    gap: spacing[2],
  },
  blurClip: {
    borderRadius: PILL_RADIUS,
    overflow: 'hidden',
  },
  specHighlight: {
    position: 'absolute',
    top: 0,
    left: spacing[4],
    right: spacing[4],
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 1,
  },
}));
