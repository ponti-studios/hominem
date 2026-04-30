import {
  colors as darkColors,
  lightColors,
  radii,
  spacing as tokenSpacing,
  type ColorToken,
} from '@hominem/ui/tokens';
import { useColorScheme } from 'react-native';
import { fontFamiliesNative, fontSizes, fontWeights, lineHeights } from './typography';

export const themeSpacing = {
  sm: tokenSpacing[2],
  md: tokenSpacing[3],
  lg: tokenSpacing[4],
  xl: tokenSpacing[6],
} as const;

const borderRadii = {
  sm: radii.sm,
  md: radii.md,
  lg: radii.lg,
  icon: radii.icon,
} as const;

export const componentSizes = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 44,
} as const;

export const typography = {
  families: fontFamiliesNative,
  sizes: fontSizes,
  weights: fontWeights,
  lineHeights,
} as const;

export const darkTheme = {
  colors: darkColors,
  spacing: themeSpacing,
  borderRadii,
  componentSizes,
  typography,
} as const;

export const lightTheme = {
  colors: lightColors,
  spacing: themeSpacing,
  borderRadii,
  componentSizes,
  typography,
} as const;

export type Theme = {
  colors: Record<ColorToken, string>;
  spacing: typeof themeSpacing;
  borderRadii: typeof borderRadii;
  componentSizes: typeof componentSizes;
  typography: typeof typography;
};

export function useThemeColors() {
  const scheme = useColorScheme();
  return scheme === 'light' ? lightColors : darkColors;
}

export default darkTheme;
