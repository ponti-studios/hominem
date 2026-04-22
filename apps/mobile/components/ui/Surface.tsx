import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles } from '~/components/theme';
import { radii, shadowsNative } from '../theme/tokens';

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

function Surface({
  border = true,
  children,
  elevation = 'surface',
  radius = 'icon',
  shadow = true,
  style,
}: SurfaceProps) {
  const styles = useSurfaceStyles();
  return (
    <View
      style={[
        styles.base,
        styles[elevation],
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

const useSurfaceStyles = makeStyles((theme) => ({
  base: {
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  surface: {
    backgroundColor: theme.colors['bg-surface'],
  },
  elevated: {
    backgroundColor: theme.colors['bg-elevated'],
  },
  overlay: {
    backgroundColor: theme.colors['bg-overlay'],
  },
  border: {
    borderColor: theme.colors['border-default'],
    borderWidth: 1,
  },
  shadow: {
    ...shadowsNative.low,
    shadowColor: theme.colors.black,
  },
}));

export { Surface };
