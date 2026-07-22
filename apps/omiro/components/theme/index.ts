import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

import defaultTheme, {
  componentSizes,
  theme,
  themeSpacing,
  useTheme,
  useThemeColors,
  type Theme,
} from './theme';

export {
  nativeShadows,
  radii,
  shadows,
  spacing,
  transitionDurations,
  type ColorToken,
  type RadiusToken,
  type SpacingToken,
} from '~/components/theme/ponti-tokens';
export { colors } from './ponti-tokens';
export { fontFamiliesNative, fontSizes, fontWeights, lineHeights, Text } from './typography';
export { componentSizes, theme, themeSpacing, useTheme, useThemeColors };
export { defaultTheme as default };
export type { Theme };

type StyleMap = Record<string, ViewStyle | TextStyle | ImageStyle>;

export const makeStyles = <T extends StyleMap>(styles: (theme: Theme) => T & StyleMap) => {
  return () => {
    return styles(useTheme());
  };
};
