import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

import { shellTheme } from '../../types/shellTheme';
import theme, {
  componentSizes,
  lightTheme,
  themeSpacing,
  useThemeColors,
  type Theme,
} from './theme';

export {
  colors,
  durations,
  radii,
  shadowsNative,
  spacing,
  type ColorToken,
  type RadiusToken,
  type SpacingToken,
} from '@hominem/ui/tokens';
export { fontFamiliesNative, fontSizes, fontWeights, lineHeights, Text } from './typography';
export { componentSizes, lightTheme, shellTheme, theme, themeSpacing, useThemeColors };
export type { Theme };

type StyleMap = Record<string, ViewStyle | TextStyle | ImageStyle>;

export const makeStyles = <T extends StyleMap>(styles: (theme: Theme) => T & StyleMap) => {
  const computed = styles(lightTheme);
  return () => computed;
};
