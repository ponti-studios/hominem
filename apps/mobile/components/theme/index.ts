import { useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { shellTheme } from '../../types/shellTheme';
import theme, { darkTheme, lightTheme, useThemeColors, type Theme } from './theme';

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
export { fontFamiliesNative, fontSizes, fontWeights, Text } from './typography';
export { darkTheme, lightTheme, shellTheme, theme, useThemeColors };
export type { Theme };

type NamedStyles<T> = {
  [P in keyof T]: ViewStyle | TextStyle | ImageStyle;
};

export const makeStyles = <T extends NamedStyles<T> | NamedStyles<unknown>>(
  styles: (theme: Theme) => T,
) => {
  const dark = styles(darkTheme);
  const light = styles(lightTheme);
  return () => {
    const scheme = useColorScheme();
    return scheme === 'light' ? light : dark;
  };
};
