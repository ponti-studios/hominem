import {
  colors as darkColors,
  radii,
  spacing as tokenSpacing,
  type ColorToken,
} from '@hominem/ui/tokens';
import { useColorScheme } from 'react-native';

import { lightColors } from './tokens/colors.light';

const spacing = {
  xs_4: tokenSpacing[1],
  sm_8: tokenSpacing[2],
  sm_12: tokenSpacing[3],
  m_16: tokenSpacing[4],
  ml_24: tokenSpacing[5],
  l_32: tokenSpacing[6],
  xl_48: tokenSpacing[7],
  xl_64: tokenSpacing[8],
} as const;

const borderRadii = {
  sm: radii.sm,
  md: radii.md,
  lg: radii.lg,
  icon: radii.icon,
} as const;

export const darkTheme = {
  colors: darkColors,
  spacing,
  borderRadii,
} as const;

export const lightTheme = {
  colors: lightColors,
  spacing,
  borderRadii,
} as const;

export type Theme = {
  colors: Record<ColorToken, string>;
  spacing: typeof spacing;
  borderRadii: typeof borderRadii;
};

export function useThemeColors() {
  const scheme = useColorScheme();
  return scheme === 'light' ? lightColors : darkColors;
}

export default darkTheme;
