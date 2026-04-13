import {
  radiiNative,
  darkColors as tokenColors,
  spacing as tokenSpacing,
} from '@hominem/ui/tokens';
import { fontFamiliesNative } from '@hominem/ui/tokens/typography.native';
import { createTheme } from '@shopify/restyle';

const PRIMARY_FONT = fontFamiliesNative.primary;
const MONO_FONT = fontFamiliesNative.mono;

const theme = createTheme({
  colors: {
    // ── Canonical design system tokens ───────────────────────────────────
    ...tokenColors,
  },

  // Spacing — named keys for Restyle, values from canonical tokens
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

  // Border radii — full scale from canonical tokens
  borderRadii: {
    sm: radiiNative.sm,
    md: radiiNative.md,
    lg: radiiNative.lg,
    xl: radiiNative.xl,
    icon: radiiNative.icon,
    full: radiiNative.full,
  },

  // Typography — Apple HIG semantic scale
  // Use these variant names everywhere; legacy aliases kept for migration safety.
  textVariants: {
    // ── Canonical Apple HIG scale ─────────────────────────────────────────
    /** Page titles, large numerics */
    display: {
      fontFamily: PRIMARY_FONT,
      fontSize: 28,
      fontWeight: '700',
      lineHeight: 34,
      letterSpacing: -0.6,
      color: 'foreground',
    },
    /** Section headers */
    'title-1': {
      fontFamily: PRIMARY_FONT,
      fontSize: 22,
      fontWeight: '700',
      lineHeight: 28,
      letterSpacing: -0.4,
      color: 'foreground',
    },
    /** Card headers, modal titles */
    'title-2': {
      fontFamily: PRIMARY_FONT,
      fontSize: 18,
      fontWeight: '600',
      lineHeight: 24,
      letterSpacing: -0.2,
      color: 'foreground',
    },
    /** List row primary labels */
    headline: {
      fontFamily: PRIMARY_FONT,
      fontSize: 17,
      fontWeight: '600',
      lineHeight: 22,
      letterSpacing: -0.1,
      color: 'foreground',
    },
    /** Standard reading text */
    body: {
      fontFamily: PRIMARY_FONT,
      fontSize: 17,
      fontWeight: '400',
      lineHeight: 24,
      letterSpacing: 0,
      color: 'text-secondary',
    },
    /** Input text, secondary body */
    callout: {
      fontFamily: PRIMARY_FONT,
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 22,
      letterSpacing: -0.1,
      color: 'text-secondary',
    },
    /** Trailing values, subtext */
    subhead: {
      fontFamily: PRIMARY_FONT,
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 20,
      letterSpacing: 0,
      color: 'text-secondary',
    },
    /** Section labels, timestamps */
    footnote: {
      fontFamily: PRIMARY_FONT,
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 18,
      letterSpacing: 0,
      color: 'text-tertiary',
    },
    /** Pills, badges, chip labels */
    caption: {
      fontFamily: PRIMARY_FONT,
      fontSize: 11,
      fontWeight: '500',
      lineHeight: 14,
      letterSpacing: 0.4,
      color: 'text-tertiary',
    },
    /** Code, IDs, monospaced values */
    mono: {
      fontFamily: MONO_FONT,
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 16,
      letterSpacing: 0,
      color: 'text-secondary',
    },

    // ── Legacy aliases (kept for migration safety — do not use in new code) ──
    /** @deprecated Use title-2 */
    title: {
      fontFamily: PRIMARY_FONT,
      fontSize: 18,
      fontWeight: '500',
      lineHeight: 24,
      letterSpacing: 0,
      color: 'foreground',
    },
    /** @deprecated Use footnote */
    label: {
      fontFamily: PRIMARY_FONT,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
      letterSpacing: 0,
      color: 'text-tertiary',
    },
    /** @deprecated Use caption */
    small: {
      fontFamily: PRIMARY_FONT,
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 16,
      letterSpacing: 0,
      color: 'text-tertiary',
    },
    /** @deprecated Use callout */
    'text-md': {
      fontFamily: PRIMARY_FONT,
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 24,
      letterSpacing: 0,
      color: 'text-secondary',
    },
    /** @deprecated Use body */
    defaults: {
      fontFamily: PRIMARY_FONT,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 20,
      color: 'text-secondary',
    },
  },
});

export type Theme = typeof theme;
export default theme;
