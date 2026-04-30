import { useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { shellTheme } from '../../types/shellTheme';
import theme, {
  componentSizes,
  darkTheme,
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
export { componentSizes, darkTheme, lightTheme, shellTheme, theme, themeSpacing, useThemeColors };
export type { Theme };

type StyleMap = Record<string, ViewStyle | TextStyle | ImageStyle>;

export const makeStyles = <T extends StyleMap>(styles: (theme: Theme) => T & StyleMap) => {
  const dark = styles(darkTheme);
  const light = styles(lightTheme);
  return () => {
    const scheme = useColorScheme();
    return scheme === 'light' ? light : dark;
  };
};
