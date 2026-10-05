import { createTheme } from '@shopify/restyle';

import { borderRadii, darkColors, lightColors, shadows, spacing, textVariants } from './tokens';

export { fontFamilies } from './tokens';

export const lightTheme = createTheme({
  colors: lightColors,
  spacing,
  borderRadii,
  textVariants,
  shadows,
});

export const darkTheme = {
  ...lightTheme,
  colors: darkColors,
};

export type Theme = typeof lightTheme;
export type TypographyVariant = keyof typeof textVariants;
