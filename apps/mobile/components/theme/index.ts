import { useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { shellTheme } from '../../types/shellTheme';
import theme, { darkTheme, lightTheme, type Theme } from './theme';

export { Text } from './typography';
export { fontFamiliesNative, fontSizes, fontWeights } from './typography';
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
export { shellTheme, theme };
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
