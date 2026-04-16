/**
 * Canonical color tokens — single dark-mode palette.
 *
 * Values MUST match the @theme block in packages/platform/ui/src/styles/globals.css.
 * Web consumes these via CSS custom properties; other platforms (e.g. mobile)
 * import this file directly.
 */

export const colors = {
  // Backgrounds
  'bg-base': 'rgba(17, 17, 19, 1)',
  'bg-surface': 'rgba(24, 25, 27, 1)',
  'bg-elevated': 'rgba(33, 34, 37, 1)',
  'bg-overlay': 'rgba(245, 246, 248, 0.06)',

  // Text
  'text-primary': 'rgba(245, 246, 248, 1)',
  'text-secondary': 'rgba(180, 185, 195, 1)',
  'text-tertiary': 'rgba(141, 147, 161, 1)',
  'text-disabled': 'rgba(97, 103, 117, 1)',

  // Borders
  'border-default': 'rgba(245, 246, 248, 0.18)',
  'border-faint': 'rgba(245, 246, 248, 0.07)',
  'border-subtle': 'rgba(245, 246, 248, 0.11)',
  'border-focus': 'rgba(142, 141, 255, 0.5)',

  // Icons
  'icon-primary': 'rgba(245, 246, 248, 1)',
  'icon-muted': 'rgba(141, 147, 161, 1)',

  // Semantic status
  success: 'rgba(61, 214, 140, 1)',
  warning: 'rgba(255, 209, 102, 1)',
  destructive: 'rgba(255, 123, 92, 1)',
  'destructive-muted': 'rgba(255, 123, 92, 0.65)',

  // Accent
  accent: 'rgba(142, 141, 255, 1)',
  'accent-foreground': 'rgba(15, 16, 40, 1)',

  // Vendor colors
  'google-maps-blue': 'rgba(66, 133, 244, 1)',

  // System / backward-compat aliases
  primary: 'rgba(0, 0, 0, 1)',
  'primary-foreground': 'rgba(255, 255, 255, 1)',
  secondary: 'rgba(245, 246, 248, 0.14)',
  'secondary-foreground': 'rgba(229, 232, 239, 1)',
  muted: 'rgba(245, 246, 248, 0.08)',
  'muted-foreground': 'rgba(180, 185, 195, 1)',
  foreground: 'rgba(245, 246, 248, 1)',
  background: 'rgba(17, 17, 19, 1)',
  'destructive-foreground': 'rgba(29, 14, 10, 1)',
  popover: 'rgba(24, 25, 27, 1)',
  'popover-foreground': 'rgba(245, 246, 248, 1)',
  input: 'rgba(24, 25, 27, 1)',
  ring: 'rgba(0, 0, 0, 1)',

  // Emphasis scale
  'emphasis-highest': 'rgba(245, 246, 248, 0.92)',
  'emphasis-high': 'rgba(245, 246, 248, 0.76)',
  'emphasis-medium': 'rgba(245, 246, 248, 0.56)',
  'emphasis-low': 'rgba(245, 246, 248, 0.38)',
  'emphasis-lower': 'rgba(245, 246, 248, 0.26)',
  'emphasis-subtle': 'rgba(245, 246, 248, 0.18)',
  'emphasis-minimal': 'rgba(245, 246, 248, 0.12)',
  'emphasis-faint': 'rgba(245, 246, 248, 0.07)',

  // Modal overlays — darkens background for sheet/modal UI
  'overlay-modal-high': 'rgba(17, 19, 24, 0.62)',
  'overlay-modal-medium': 'rgba(17, 19, 24, 0.46)',

  // Charts
  'chart-1': 'rgba(142, 141, 255, 1)',
  'chart-2': 'rgba(61, 214, 140, 1)',
  'chart-3': 'rgba(56, 189, 248, 1)',
  'chart-4': 'rgba(255, 209, 102, 1)',
  'chart-5': 'rgba(255, 123, 92, 1)',

  // Sidebar
  sidebar: 'rgba(15, 16, 18, 1)',
  'sidebar-foreground': 'rgba(245, 246, 248, 1)',
  'sidebar-primary': 'rgba(142, 141, 255, 1)',
  'sidebar-primary-foreground': 'rgba(15, 16, 40, 1)',
  'sidebar-accent': 'rgba(245, 246, 248, 0.08)',
  'sidebar-accent-foreground': 'rgba(245, 246, 248, 1)',
  'sidebar-border': 'rgba(245, 246, 248, 0.14)',
  'sidebar-ring': 'rgba(142, 141, 255, 1)',

  // Prompt input
  'prompt-bg': 'rgba(24, 25, 27, 1)',
  'prompt-border': 'rgba(245, 246, 248, 0.18)',
  'prompt-border-focus': 'rgba(142, 141, 255, 0.5)',

  // Primitives used by mobile shadow system
  black: 'rgba(0, 0, 0, 1)',
  white: 'rgba(255, 255, 255, 1)',
} as const;

export type ColorToken = keyof typeof colors;
