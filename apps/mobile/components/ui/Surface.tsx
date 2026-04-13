import { radiiNative, shadowsNative } from '@hominem/ui/tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { theme } from '~/components/theme';

type Elevation = 'surface' | 'elevated' | 'overlay';
type Radius = keyof typeof radiiNative;

export interface SurfaceProps {
  elevation?: Elevation;
  radius?: Radius;
  border?: boolean;
  shadow?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}

const elevationBg: Record<Elevation, string> = {
  surface: theme.colors['bg-surface'],
  elevated: theme.colors['bg-elevated'],
  overlay: theme.colors['bg-overlay'],
};

export function Surface({
  elevation = 'surface',
  radius = 'icon',
  border = true,
  shadow = true,
  style,
  children,
}: SurfaceProps) {
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: elevationBg[elevation] },
        { borderRadius: radiiNative[radius] },
        border && styles.border,
        shadow && styles.shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  border: {
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
  },
  shadow: {
    ...shadowsNative.low,
    shadowColor: theme.colors.black,
  },
});
