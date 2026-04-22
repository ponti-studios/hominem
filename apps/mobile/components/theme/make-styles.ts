import { useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { darkTheme, lightTheme, type Theme } from './theme';

type NamedStyles<T> = {
  [P in keyof T]: ViewStyle | TextStyle | ImageStyle;
};

export const makeStylesInternal = <T extends NamedStyles<T> | NamedStyles<unknown>>(
  styles: (theme: Theme) => T,
) => {
  const dark = styles(darkTheme);
  const light = styles(lightTheme);
  return () => {
    const scheme = useColorScheme();
    return scheme === 'light' ? light : dark;
  };
};
