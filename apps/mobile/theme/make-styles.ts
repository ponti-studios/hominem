import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

import theme, { type Theme } from './theme';

type NamedStyles<T> = {
  [P in keyof T]: ViewStyle | TextStyle | ImageStyle;
};

export const makeStylesInternal = <T extends NamedStyles<T> | NamedStyles<unknown>>(
  styles: (theme: Theme) => T,
) => {
  return () => {
    return styles(theme);
  };
};
