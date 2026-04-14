import {
  colors as tokenColors,
  radiiNative,
  spacing as tokenSpacing,
} from '@hominem/ui/tokens';
import { fontFamiliesNative } from '@hominem/ui/tokens/typography.native';
import { createTheme } from '@shopify/restyle';

const theme = createTheme({
  colors: {
    ...tokenColors,
  },
  spacing: {
    xs_4: tokenSpacing[1],
    sm_8: tokenSpacing[2],
    sm_12: tokenSpacing[3],
    m_16: tokenSpacing[4],
    ml_24: tokenSpacing[5],
    l_32: tokenSpacing[6],
    xl_48: tokenSpacing[7],
    xl_64: tokenSpacing[8],
  },
  borderRadii: {
    sm: radiiNative.sm,
    md: radiiNative.md,
    lg: radiiNative.lg,
    xl: radiiNative.xl,
    icon: radiiNative.icon,
    full: radiiNative.full,
  },
  textVariants: {
    largeTitle: {
      color: 'foreground',
      fontFamily: fontFamiliesNative.primary,
      fontSize: 34,
      fontWeight: '700',
      letterSpacing: -0.6,
      lineHeight: 41,
    },
    title1: {
      color: 'foreground',
      fontFamily: fontFamiliesNative.primary,
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.4,
      lineHeight: 34,
    },
    title2: {
      color: 'foreground',
      fontFamily: fontFamiliesNative.primary,
      fontSize: 22,
      fontWeight: '600',
      letterSpacing: -0.2,
      lineHeight: 28,
    },
    headline: {
      color: 'foreground',
      fontFamily: fontFamiliesNative.primary,
      fontSize: 17,
      fontWeight: '600',
      letterSpacing: -0.1,
      lineHeight: 22,
    },
    body: {
      color: 'text-secondary',
      fontFamily: fontFamiliesNative.primary,
      fontSize: 17,
      fontWeight: '400',
      letterSpacing: 0,
      lineHeight: 24,
    },
    callout: {
      color: 'text-secondary',
      fontFamily: fontFamiliesNative.primary,
      fontSize: 16,
      fontWeight: '400',
      letterSpacing: -0.1,
      lineHeight: 22,
    },
    subhead: {
      color: 'text-secondary',
      fontFamily: fontFamiliesNative.primary,
      fontSize: 15,
      fontWeight: '400',
      letterSpacing: 0,
      lineHeight: 20,
    },
    footnote: {
      color: 'text-tertiary',
      fontFamily: fontFamiliesNative.primary,
      fontSize: 13,
      fontWeight: '400',
      letterSpacing: 0,
      lineHeight: 18,
    },
    caption1: {
      color: 'text-tertiary',
      fontFamily: fontFamiliesNative.primary,
      fontSize: 12,
      fontWeight: '400',
      letterSpacing: 0,
      lineHeight: 16,
    },
    caption2: {
      color: 'text-tertiary',
      fontFamily: fontFamiliesNative.primary,
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 0.2,
      lineHeight: 14,
    },
    mono: {
      color: 'text-secondary',
      fontFamily: fontFamiliesNative.mono,
      fontSize: 12,
      fontWeight: '400',
      letterSpacing: 0,
      lineHeight: 16,
    },
  },
});

export type Theme = typeof theme;
export default theme;
