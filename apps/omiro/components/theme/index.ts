import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

import { componentSizes, theme, themeSpacing, useTheme, useThemeColors, type Theme } from './theme';

export {
  radii,
  shadows,
  spacing,
  transitionDurations,
  type ColorToken,
  type RadiusToken,
  type SpacingToken,
} from '~/components/theme/tokens';
export { colors } from './tokens';
export { fontFamiliesNative, fontSizes, fontWeights, lineHeights, Text } from './typography';
export { componentSizes, theme, themeSpacing, useTheme, useThemeColors };
export type { Theme };

type StyleMap = Record<string, ViewStyle | TextStyle | ImageStyle>;

export const makeStyles = <T extends StyleMap>(styles: (theme: Theme) => T & StyleMap) => {
  return () => {
    return styles(useTheme());
  };
};
