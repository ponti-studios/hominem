import {
  borderRadii,
  lightColors,
  shadows,
  spacing,
  textVariants,
} from '~/components/theme/tokens';

// A stand-in for `~/components/theme` backed by the real design tokens, so
// component tests style against real values instead of hand-rolled partials
// that go stale whenever a token is added. (The restyle runtime itself can't
// load under vitest, which is why tokens live in their own module.)
const theme = { borderRadii, colors: lightColors, shadows, spacing, textVariants };

export const themeModuleMock = {
  useAppTheme: () => theme,
  useStyles: <T>(factory: (current: typeof theme) => T): T => factory(theme),
  withAlpha: (color: string): string => color,
};
