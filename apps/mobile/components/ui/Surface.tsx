import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, shadowsNative } from '../theme/tokens';

type Elevation = 'surface' | 'elevated' | 'overlay';
type Radius = keyof typeof radii;

export interface SurfaceProps {
  border?: boolean | undefined;
  children: ReactNode;
  elevation?: Elevation | undefined;
  radius?: Radius | undefined;
  shadow?: boolean | undefined;
  style?: StyleProp<ViewStyle>;
}

const elevationStyles: Record<Elevation, ViewStyle> = {
  surface: {
    backgroundColor: colors['bg-surface'],
  },
  elevated: {
    backgroundColor: colors['bg-elevated'],
  },
  overlay: {
    backgroundColor: colors['bg-overlay'],
  },
};

function Surface({
  border = true,
  children,
  elevation = 'surface',
  radius = 'icon',
  shadow = true,
  style,
}: SurfaceProps) {
  return (
    <View
      style={[
        styles.base,
        elevationStyles[elevation],
        { borderRadius: radii[radius] },
        border ? styles.border : null,
        shadow ? styles.shadow : null,
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
    borderColor: colors['border-default'],
    borderWidth: 1,
  },
  shadow: {
    ...shadowsNative.low,
    shadowColor: colors.black,
  },
});

export { Surface };
