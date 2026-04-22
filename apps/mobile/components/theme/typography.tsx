import { colors as darkColors } from '@hominem/ui/tokens';
import type { ColorToken } from '@hominem/ui/tokens';
import {
  Text as RNText,
  Platform,
  useColorScheme,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { lightColors } from './tokens/colors.light';

// ── Font Tokens ───────────────────────────────────────────────────────────────

export const fontFamiliesNative = {
  primary:
    Platform.select({
      ios: 'System',
      android: 'sans-serif',
      default: 'sans-serif',
    }) ?? 'sans-serif',
  mono:
    Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }) ?? 'monospace',
} as const;

export const fontSizes = {
  micro: 10,
  caption2: 11,
  caption1: 12,
  footnote: 13,
  xs: 12,
  sm: 14,
  subhead: 15,
  md: 16,
  body: 17,
  lg: 18,
  xl: 20,
  headline: 17,
  display: 28,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeights = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

export const letterSpacing = {
  tight: -0.05,
  normal: 0,
  relaxed: 0.01,
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type AppleTextVariant =
  | 'largeTitle'
  | 'title1'
  | 'title2'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption1'
  | 'caption2'
  | 'mono';

export type LegacyTextVariant = 'body-1' | 'body-2' | 'body-3' | 'body-4';

export type TextVariant = AppleTextVariant | LegacyTextVariant;

// ── Text Component ────────────────────────────────────────────────────────────

interface TextProps extends RNTextProps {
  color?: ColorToken | undefined;
  muted?: boolean | undefined;
  style?: StyleProp<TextStyle>;
  variant?: TextVariant | undefined;
}

const variantStyles = {
  largeTitle: {
    fontFamily: fontFamiliesNative.primary,
    fontSize: 34,
    fontWeight: fontWeights.bold,
    lineHeight: 41,
    letterSpacing: -0.6,
  },
  title1: {
    fontFamily: fontFamiliesNative.primary,
    fontSize: 28,
    fontWeight: fontWeights.bold,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  title2: {
    fontFamily: fontFamiliesNative.primary,
    fontSize: 22,
    fontWeight: fontWeights.semibold,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  headline: {
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.headline,
    fontWeight: fontWeights.semibold,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  body: {
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.regular,
    lineHeight: 24,
    letterSpacing: 0,
  },
  callout: {
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  subhead: {
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.subhead,
    fontWeight: fontWeights.regular,
    lineHeight: 20,
    letterSpacing: 0,
  },
  footnote: {
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.footnote,
    fontWeight: fontWeights.regular,
    lineHeight: 18,
    letterSpacing: 0,
  },
  caption1: {
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.caption1,
    fontWeight: fontWeights.regular,
    lineHeight: 16,
    letterSpacing: 0,
  },
  caption2: {
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.caption2,
    fontWeight: fontWeights.medium,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  mono: {
    fontFamily: fontFamiliesNative.mono,
    fontSize: fontSizes.caption1,
    fontWeight: fontWeights.regular,
    lineHeight: 16,
    letterSpacing: 0,
  },
} satisfies Record<string, TextStyle>;

const legacyVariantMap = {
  'body-1': 'headline',
  'body-2': 'body',
  'body-3': 'footnote',
  'body-4': 'caption1',
} as const;

function Text({ color, muted = false, style, variant = 'body', ...props }: TextProps) {
  const scheme = useColorScheme();
  const colors = scheme === 'light' ? lightColors : darkColors;
  const resolvedVariant = legacyVariantMap[variant as keyof typeof legacyVariantMap] ?? variant;
  const resolvedColor = color
    ? colors[color]
    : muted
      ? colors['text-tertiary']
      : colors['text-primary'];

  return (
    <RNText style={[variantStyles[resolvedVariant], { color: resolvedColor }, style]} {...props} />
  );
}

export { Text };
export type { TextProps };
