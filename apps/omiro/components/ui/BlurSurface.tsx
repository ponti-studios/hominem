// oxlint-disable-next-line no-restricted-imports -- BlurSurface is the approved design-system wrapper for expo-blur
import { BlurView } from 'expo-blur';
import { StyleSheet, type ViewProps } from 'react-native';

export type BlurSurfaceTint =
  | 'chrome' // keyboard toolbars, navigation bars
  | 'regular' // cards, sheets
  | 'thin' // overlays, popovers
  | 'thick'; // prominent surfaces

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
  return (
    <BlurView tint={TINT_MAP[tint]} intensity={intensity} style={[styles.base, style]} {...props}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
