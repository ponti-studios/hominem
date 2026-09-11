import { BlurView } from 'expo-blur';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useAppTheme, useColorMode, withAlpha } from '~/components/theme';

const BLUR_INTENSITY = 40;

interface BlurCardProps extends ViewProps {
  contentStyle?: StyleProp<ViewStyle>;
}

// Shared translucent, blurred composer surface -- the omiro equivalent of
// web's `rounded-xl border-border/50 bg-card/40 shadow-sm backdrop-blur-md`.
// `style` overrides the outer surface (radius/border/shadow); `contentStyle`
// overrides the inner padding/gap.
export function BlurCard({
  children,
  style,
  contentStyle,
  ...props
}: PropsWithChildren<BlurCardProps>) {
  const theme = useAppTheme();
  const colorMode = useColorMode();

  // expo-blur's iOS blur is driven by a UIViewPropertyAnimator kicked off from
  // `setNeedsDisplay()`, which can fail to produce a real draw pass on first
  // mount (the view hasn't settled into the window yet) -- it just shows a
  // flat, undistorted surface until something else forces a redraw (e.g. the
  // keyboard opening). Nudging intensity on the next frame forces that first
  // real draw so the blur is live immediately at rest.
  const [intensity, setIntensity] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setIntensity(BLUR_INTENSITY));
    return () => cancelAnimationFrame(id);
  }, []);

  const containerStyle: ViewStyle = {
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.border, 0.5),
    boxShadow: theme.shadows.sm,
    overflow: 'hidden',
  };

  const defaultContentStyle: ViewStyle = { padding: 16, gap: 16 };

  return (
    <View {...props} collapsable={false} style={[containerStyle, style]}>
      <BlurView
        intensity={intensity}
        style={StyleSheet.absoluteFill}
        tint={colorMode === 'dark' ? 'dark' : 'light'}
      />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.colors.card, 0.4) }]}
      />
      <View style={[defaultContentStyle, contentStyle]}>{children}</View>
    </View>
  );
}
