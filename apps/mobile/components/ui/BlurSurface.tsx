import { BlurView } from 'expo-blur';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useThemeColors } from '~/components/theme/theme';

export type BlurSurfaceTint =
  | 'chrome'       // keyboard toolbars, navigation bars
  | 'regular'      // cards, sheets
  | 'thin'         // overlays, popovers
  | 'thick';       // prominent surfaces

const TINT_MAP = {
  chrome: 'systemChromeMaterial',
  regular: 'systemMaterial',
  thin: 'systemThinMaterial',
  thick: 'systemThickMaterial',
} as const;

interface BlurSurfaceProps extends ViewProps {
  tint?: BlurSurfaceTint;
  intensity?: number;
}

export function BlurSurface({
  tint = 'regular',
  intensity = 100,
  style,
  children,
  ...props
}: BlurSurfaceProps) {
  const themeColors = useThemeColors();

  return (
    <BlurView
      tint={TINT_MAP[tint]}
      intensity={intensity}
      style={[styles.fill, style]}
      {...props}
    >
      {children}
    </BlurView>
  );
}

// Android fallback: expo-blur renders a semi-transparent view on Android,
// but we wrap it so callers don't need platform checks.
export function BlurSurfaceAndroidFallback({
  style,
  children,
  ...props
}: ViewProps) {
  const themeColors = useThemeColors();
  return (
    <View style={[styles.fill, { backgroundColor: themeColors['bg-elevated'] }, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    overflow: 'hidden',
  },
});
