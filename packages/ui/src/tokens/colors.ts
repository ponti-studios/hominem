/**
 * Canonical color tokens — dark luxury palette.
 *
 * Heritage-inspired dark theme with warm luxury accents.
 * Values MUST match the @theme block in packages/ui/src/styles.css.
 * Web consumes these via CSS custom properties; other platforms (e.g. mobile)
 * import this file directly.
 */

export const colors = {
  // Backgrounds — dark foundations
  'bg-base': 'rgba(20, 18, 16, 1)',
  'bg-surface': 'rgba(26, 23, 20, 1)',
  'bg-elevated': 'rgba(33, 29, 25, 1)',
  'bg-overlay': 'rgba(200, 168, 130, 0.06)',

  // Text — light for dark backgrounds
  'text-primary': 'rgba(250, 244, 234, 1)',
  'text-secondary': 'rgba(160, 112, 58, 1)',
  'text-tertiary': 'rgba(139, 103, 79, 1)',
  'text-disabled': 'rgba(104, 82, 60, 1)',

  // Borders — luxury warm tones
  'border-default': 'rgba(200, 168, 130, 0.3)',
  'border-faint': 'rgba(200, 168, 130, 0.12)',
  'border-subtle': 'rgba(200, 168, 130, 0.18)',
  'border-focus': 'rgba(200, 168, 130, 0.6)',

  // Icons
  'icon-primary': 'rgba(250, 244, 234, 1)',
  'icon-muted': 'rgba(139, 103, 79, 1)',

  // Semantic status
  success: 'rgba(74, 92, 60, 1)',
  warning: 'rgba(160, 112, 58, 1)',
  destructive: 'rgba(140, 28, 28, 1)',
  'destructive-muted': 'rgba(140, 28, 28, 0.65)',

  // Accent — luxury canvas tan
  accent: 'rgba(200, 168, 130, 1)',
  'accent-foreground': 'rgba(20, 18, 16, 1)',

  // Vendor colors
  'google-maps-blue': 'rgba(66, 133, 244, 1)',

  // System / backward-compat aliases
  primary: 'rgba(20, 18, 16, 1)',
  'primary-foreground': 'rgba(250, 244, 234, 1)',
  secondary: 'rgba(200, 168, 130, 0.18)',
  'secondary-foreground': 'rgba(250, 244, 234, 1)',
  muted: 'rgba(200, 168, 130, 0.12)',
  'muted-foreground': 'rgba(160, 112, 58, 1)',
  foreground: 'rgba(250, 244, 234, 1)',
  background: 'rgba(20, 18, 16, 1)',
  'destructive-foreground': 'rgba(250, 244, 234, 1)',
  popover: 'rgba(26, 23, 20, 1)',
  'popover-foreground': 'rgba(250, 244, 234, 1)',
  input: 'rgba(33, 29, 25, 1)',
  ring: 'rgba(200, 168, 130, 1)',

  // Emphasis scale — light text on dark
  'emphasis-highest': 'rgba(250, 244, 234, 0.92)',
  'emphasis-high': 'rgba(250, 244, 234, 0.76)',
  'emphasis-medium': 'rgba(250, 244, 234, 0.56)',
  'emphasis-low': 'rgba(250, 244, 234, 0.38)',
  'emphasis-lower': 'rgba(250, 244, 234, 0.26)',
  'emphasis-subtle': 'rgba(250, 244, 234, 0.18)',
  'emphasis-minimal': 'rgba(250, 244, 234, 0.12)',
  'emphasis-faint': 'rgba(250, 244, 234, 0.07)',

  // Modal overlays — darkens background for sheet/modal UI
  'overlay-modal-high': 'rgba(20, 18, 16, 0.72)',
  'overlay-modal-medium': 'rgba(20, 18, 16, 0.56)',

  // Charts — luxury palette
  'chart-1': 'rgba(200, 168, 130, 1)',
  'chart-2': 'rgba(74, 92, 60, 1)',
  'chart-3': 'rgba(139, 103, 79, 1)',
  'chart-4': 'rgba(160, 112, 58, 1)',
  'chart-5': 'rgba(200, 168, 130, 0.6)',

  // Sidebar
  sidebar: 'rgba(26, 23, 20, 1)',
  'sidebar-foreground': 'rgba(250, 244, 234, 1)',
  'sidebar-primary': 'rgba(200, 168, 130, 1)',
  'sidebar-primary-foreground': 'rgba(20, 18, 16, 1)',
  'sidebar-accent': 'rgba(200, 168, 130, 0.12)',
  'sidebar-accent-foreground': 'rgba(250, 244, 234, 1)',
  'sidebar-border': 'rgba(200, 168, 130, 0.18)',
  'sidebar-ring': 'rgba(200, 168, 130, 1)',

  // Prompt input
  'prompt-bg': 'rgba(33, 29, 25, 1)',
  'prompt-border': 'rgba(200, 168, 130, 0.3)',
  'prompt-border-focus': 'rgba(200, 168, 130, 0.6)',

  // Primitives used by mobile shadow system
  black: 'rgba(0, 0, 0, 1)',
  white: 'rgba(255, 255, 255, 1)',
} as const;

export type ColorToken = keyof typeof colors;
