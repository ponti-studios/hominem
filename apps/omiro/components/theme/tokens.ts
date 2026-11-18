// Design tokens: plain data with no runtime dependencies, so they can be
// shared by the restyle theme, native modules and tests alike.
import type { TextStyle } from 'react-native';

export const fontFamilies = {
  sans: 'Geist',
  mono: 'Geist Mono',
  pixel: 'Geist Pixel Square',
} as const;

// Liquid Glass palette: an ink-dark foreground on a calm lavender ground, with
// violet as the action color and coral/lime as accents. Chrome floats on system
// glass (`glass*`, `bar*`); `ink*` is the high-contrast inverted fill;
// `event*` are the pastel fills for calendar blocks; `lime*` marks completion.
// Tokens, not literals, so every screen picks the system up.
export const lightColors = {
  background: '#F4F2FB',
  card: '#FFFFFF',
  cardForeground: '#14121F',
  popover: '#FFFFFF',
  popoverForeground: '#14121F',
  muted: '#EDE9FE',
  foreground: '#14121F',
  mutedForeground: '#625F78',
  tertiary: '#625F78',
  primary: '#6C4DFF',
  // Text-safe tones (>=4.5:1 on the light surfaces). Fills keep the base colors.
  primaryText: '#6C4DFF',
  secondary: '#EDE9FE',
  secondaryForeground: '#14121F',
  accent: '#EDE9FE',
  accentForeground: '#14121F',
  destructive: '#D93B2B',
  success: '#0F8A5F',
  warning: '#F59E0B',
  warningText: '#8A4F00',
  primaryForeground: '#FFFFFF',
  destructiveForeground: '#FFFFFF',
  border: '#E6E1FA',
  input: '#E6E1FA',
  ring: '#6C4DFF',
  overlayScrim: '#14121F',
  ink: '#14121F',
  inkForeground: '#FFFFFF',
  // What the system glass is tinted with, and the solid stand-in (plus its
  // hairline edge) used when Reduce Transparency turns glass off.
  glassTint: '#FFFFFF33',
  glassFallback: '#FFFFFF',
  glassStroke: '#14121F1F',
  // Soft colour pools behind root screens, so glass has something to bend.
  aurora1: '#B9A8FF',
  aurora2: '#FFC2B8',
  aurora3: '#A9E4FF',
  // Drawn on a glass bar (composer, search bar, toasts, the dock's stopping and
  // failed bars). `bar` is the fill under them when glass is off.
  bar: '#FFFFFF',
  barForeground: '#14121F',
  barAccent: '#6C4DFF',
  barAccentForeground: '#FFFFFF',
  // Controls drawn on a bar surface (disabled stop, edit button).
  barControl: 'rgba(127, 127, 160, 0.3)',
  // Text and icons over the dark image scrim.
  scrimForeground: '#FFFFFF',
  // Neutral tile behind a tool-call icon that was rejected.
  neutralTile: 'rgba(127, 127, 160, 0.2)',
  coral: '#FF6B57',
  // Coral for text and labels: passes WCAG AA on the light surfaces.
  coralText: '#B8321F',
  lime: '#C9F36B',
  limeForeground: '#14121F',
  eventViolet: '#E2D9FF',
  eventCoral: '#FFD8D0',
  eventSky: '#CFEFFF',
  eventSun: '#FFEFAE',
  eventForeground: '#14121F',
  chart1: '#6C4DFF',
  chart2: '#FF6B57',
  chart3: '#3FB6EA',
  chart4: '#F5C518',
  chart5: '#8BC34A',
} as const;

export const darkColors = {
  background: '#0B0A14',
  card: '#1B1830',
  cardForeground: '#F4F2FF',
  popover: '#1B1830',
  popoverForeground: '#F4F2FF',
  muted: '#241F3D',
  foreground: '#F4F2FF',
  mutedForeground: '#A29FBA',
  tertiary: '#A29FBA',
  primary: '#6C4DFF',
  primaryText: '#A894FF',
  secondary: '#241F3D',
  secondaryForeground: '#F4F2FF',
  accent: '#241F3D',
  accentForeground: '#F4F2FF',
  destructive: '#FF7D6B',
  success: '#34D399',
  warning: '#FBBF24',
  warningText: '#FBBF24',
  primaryForeground: '#FFFFFF',
  destructiveForeground: '#14121F',
  border: '#2B2745',
  input: '#2B2745',
  ring: '#9A86FF',
  overlayScrim: '#000000',
  ink: '#F4F2FF',
  inkForeground: '#14121F',
  // What the system glass is tinted with, and the solid stand-in (plus its
  // hairline edge) used when Reduce Transparency turns glass off.
  glassTint: '#1B183033',
  glassFallback: '#1B1830',
  glassStroke: '#FFFFFF29',
  // Soft colour pools behind root screens, so glass has something to bend.
  aurora1: '#3A2A8C',
  aurora2: '#5A2238',
  aurora3: '#123A55',
  // Drawn on a glass bar (composer, search bar, toasts, the dock's stopping and
  // failed bars). `bar` is the fill under them when glass is off.
  bar: '#1B1830',
  barForeground: '#F4F2FF',
  barAccent: '#6C4DFF',
  barAccentForeground: '#FFFFFF',
  // Controls drawn on a bar surface (disabled stop, edit button).
  barControl: 'rgba(127, 127, 160, 0.3)',
  // Text and icons over the dark image scrim.
  scrimForeground: '#FFFFFF',
  // Neutral tile behind a tool-call icon that was rejected.
  neutralTile: 'rgba(127, 127, 160, 0.2)',
  coral: '#FF7D6B',
  // Coral for text and labels: passes WCAG AA on the dark surfaces.
  coralText: '#FF9A8A',
  lime: '#C9F36B',
  limeForeground: '#14121F',
  eventViolet: '#3B2F7E',
  eventCoral: '#6B2F2A',
  eventSky: '#1F4660',
  eventSun: '#6A5A1B',
  eventForeground: '#F4F2FF',
  chart1: '#8B73FF',
  chart2: '#FF7D6B',
  chart3: '#5BC8FF',
  chart4: '#FFD23F',
  chart5: '#C9F36B',
} as const;

export const spacing = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  '4xl': 32,
  '5xl': 40,
  '6xl': 48,
} as const;

export const borderRadii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 26,
  '2xl': 34,
  pill: 999,
} as const;

export const shadows = {
  none: [
    {
      color: 'transparent',
      offsetX: 0,
      offsetY: 0,
      blurRadius: 0,
      spreadDistance: 0,
      inset: false,
    },
  ],
  sm: [
    { color: '#0000001a', offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, inset: false },
  ],
  md: [
    { color: '#00000024', offsetX: 0, offsetY: 3, blurRadius: 6, spreadDistance: 0, inset: false },
  ],
  // The one soft shadow in the system, and only under the glass fallback: real
  // glass carries its own depth. List rows and cards stay flat -- blur shadows
  // on every row are the classic scroll-jank source.
  float: [
    { color: '#14121F29', offsetX: 0, offsetY: 8, blurRadius: 24, spreadDistance: 0, inset: false },
  ],
} as const;

const baseTextVariant: TextStyle = {
  fontFamily: fontFamilies.sans,
  fontSize: 17,
  lineHeight: 24,
  fontWeight: '400',
  letterSpacing: 0,
};

export const textVariants = {
  defaults: baseTextVariant,
  display: {
    fontFamily: fontFamilies.sans,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  largeTitle: {
    fontFamily: fontFamilies.sans,
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  title1: {
    fontFamily: fontFamilies.sans,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  title2: {
    fontFamily: fontFamilies.sans,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  headline: {
    fontFamily: fontFamilies.sans,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  body: baseTextVariant,
  callout: {
    fontFamily: fontFamilies.sans,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.1,
  },
  subhead: {
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: 0,
  },
  footnote: {
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: 0,
  },
  caption1: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0,
  },
  caption2: {
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  overline: {
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontFamily: fontFamilies.sans,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  label: {
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  chip: {
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0,
  },
  mono: {
    fontFamily: fontFamilies.mono,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0,
  },
} satisfies Record<string, TextStyle>;
