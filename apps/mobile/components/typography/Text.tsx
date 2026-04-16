import {
  Text as RNText,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { colors, fontSizes, fontWeights } from '~/components/theme/tokens';
import type { ColorToken } from '~/components/theme/tokens';
import { fontFamiliesNative } from '~/components/theme/tokens/typography.native';
import type { TextVariant } from './text.types';

interface TextProps extends RNTextProps {
  color?: ColorToken | undefined;
  muted?: boolean | undefined;
  style?: StyleProp<TextStyle>;
  variant?: TextVariant | undefined;
}

const appleVariantStyles = {
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
  const resolvedVariant = legacyVariantMap[variant as keyof typeof legacyVariantMap] ?? variant;
  const resolvedColor = color
    ? colors[color]
    : muted
      ? colors['text-tertiary']
      : colors['text-primary'];

  return (
    <RNText
      style={[appleVariantStyles[resolvedVariant], { color: resolvedColor }, style]}
      {...props}
    />
  );
}

export { Text };
export type { TextProps };
