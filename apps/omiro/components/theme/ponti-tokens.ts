import {
  colorSystems as canonicalColorSystems,
  durations,
  radii,
  shadowsNative,
  spacing,
  type RadiusToken,
  type SpacingToken,
} from '@ponti-studios/ui/tokens';

const ponti = canonicalColorSystems.ponti.dark;

/**
 * Native compatibility map. Omiro uses these names at its React Native style
 * boundary; every value is sourced from the canonical Ponti semantic palette.
 */
export const colors = {
  accent: ponti.accent,
  background: ponti['surface-canvas'],
  black: ponti['text-on-warning'],
  'bg-base': ponti['surface-canvas'],
  'bg-elevated': ponti['surface-raised'],
  'bg-surface': ponti['surface-panel'],
  'border-default': ponti['border-default'],
  'border-faint': ponti['border-subtle'],
  'border-subtle': ponti['border-subtle'],
  destructive: ponti.destructive,
  foreground: ponti['text-primary'],
  'icon-muted': ponti['text-tertiary'],
  'icon-primary': ponti['text-primary'],
  muted: ponti['surface-inset'],
  'overlay-modal-high': ponti['overlay-scrim'],
  'overlay-modal-medium': ponti['overlay-scrim'],
  primary: ponti.accent,
  'primary-foreground': ponti['text-on-accent'],
  'text-primary': ponti['text-primary'],
  'text-secondary': ponti['text-secondary'],
  'text-tertiary': ponti['text-tertiary'],
  success: ponti.success,
  warning: ponti.warning,
  white: ponti['text-on-accent'],
} as const;

export const colorSystems = { ponti: canonicalColorSystems.ponti } as const;

export type ColorToken = keyof typeof colors;

export { durations, radii, shadowsNative, spacing };
export type { RadiusToken, SpacingToken };
