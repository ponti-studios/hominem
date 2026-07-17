import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

import defaultTheme, {
  componentSizes,
  theme,
  themeSpacing,
  useThemeColors,
  type Theme,
} from './theme';

export {
  durations,
  radii,
  shadowsNative,
  spacing,
  type ColorToken,
  type RadiusToken,
  type SpacingToken,
} from '~/components/theme/ponti-tokens';
export { colors } from './theme';
export { fontFamiliesNative, fontSizes, fontWeights, lineHeights, Text } from './typography';
export { componentSizes, theme, themeSpacing, useThemeColors };
export { defaultTheme as default };
export type { Theme };

type StyleMap = Record<string, ViewStyle | TextStyle | ImageStyle>;

export const makeStyles = <T extends StyleMap>(styles: (theme: Theme) => T & StyleMap) => {
  const computed = styles(theme);
  return () => computed;
};
