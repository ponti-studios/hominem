/**
 * Typography tokens.
 *
 * Font size and weight values must match --font-* in globals.css.
 *
 * Font families diverge intentionally between platforms:
 * - Web loads Geist via Google Fonts (COMMON_FONT_LINKS)
 * - Native uses the platform system fonts
 */

import { Platform } from 'react-native';

/** Web font family stacks (full CSS strings). */
export const fontFamilies = {
  primary: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  mono: "'Geist Mono', ui-monospace, 'SF Mono', 'Menlo', monospace",
} as const;

/** React Native font family names (platform system fonts). */
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

export type FontSizeToken = keyof typeof fontSizes;
export type FontWeightToken = keyof typeof fontWeights;
