import type { ColorToken } from '@hominem/ui/tokens';

export const lightColors = {
  // Backgrounds
  'bg-base': 'rgba(255, 255, 255, 1)',
  'bg-surface': 'rgba(248, 248, 250, 1)',
  'bg-elevated': 'rgba(240, 241, 244, 1)',
  'bg-overlay': 'rgba(0, 0, 0, 0.04)',

  // Text
  'text-primary': 'rgba(15, 16, 18, 1)',
  'text-secondary': 'rgba(70, 75, 90, 1)',
  'text-tertiary': 'rgba(120, 128, 145, 1)',
  'text-disabled': 'rgba(170, 178, 195, 1)',

  // Borders
  'border-default': 'rgba(0, 0, 0, 0.14)',
  'border-faint': 'rgba(0, 0, 0, 0.06)',
  'border-subtle': 'rgba(0, 0, 0, 0.09)',
  'border-focus': 'rgba(109, 108, 235, 0.5)',

  // Icons
  'icon-primary': 'rgba(15, 16, 18, 1)',
  'icon-muted': 'rgba(120, 128, 145, 1)',

  // Semantic status
  success: 'rgba(22, 163, 74, 1)',
  warning: 'rgba(180, 120, 0, 1)',
  destructive: 'rgba(200, 40, 40, 1)',
  'destructive-muted': 'rgba(200, 40, 40, 0.12)',

  // Accent
  accent: 'rgba(109, 108, 235, 1)',
  'accent-foreground': 'rgba(255, 255, 255, 1)',

  // Vendor colors
  'google-maps-blue': 'rgba(66, 133, 244, 1)',

  // System / backward-compat aliases
  primary: 'rgba(255, 255, 255, 1)',
  'primary-foreground': 'rgba(0, 0, 0, 1)',
  secondary: 'rgba(0, 0, 0, 0.07)',
  'secondary-foreground': 'rgba(15, 16, 18, 1)',
  muted: 'rgba(0, 0, 0, 0.05)',
  'muted-foreground': 'rgba(70, 75, 90, 1)',
  foreground: 'rgba(15, 16, 18, 1)',
  background: 'rgba(255, 255, 255, 1)',
  'destructive-foreground': 'rgba(255, 255, 255, 1)',
  popover: 'rgba(248, 248, 250, 1)',
  'popover-foreground': 'rgba(15, 16, 18, 1)',
  input: 'rgba(248, 248, 250, 1)',
  ring: 'rgba(109, 108, 235, 1)',

  // Emphasis scale (alpha-black, inverted from dark's alpha-white)
  'emphasis-highest': 'rgba(0, 0, 0, 0.88)',
  'emphasis-high': 'rgba(0, 0, 0, 0.72)',
  'emphasis-medium': 'rgba(0, 0, 0, 0.52)',
  'emphasis-low': 'rgba(0, 0, 0, 0.34)',
  'emphasis-lower': 'rgba(0, 0, 0, 0.22)',
  'emphasis-subtle': 'rgba(0, 0, 0, 0.14)',
  'emphasis-minimal': 'rgba(0, 0, 0, 0.08)',
  'emphasis-faint': 'rgba(0, 0, 0, 0.05)',

  // Modal overlays
  'overlay-modal-high': 'rgba(0, 0, 0, 0.42)',
  'overlay-modal-medium': 'rgba(0, 0, 0, 0.28)',

  // Charts
  'chart-1': 'rgba(109, 108, 235, 1)',
  'chart-2': 'rgba(22, 163, 74, 1)',
  'chart-3': 'rgba(14, 165, 233, 1)',
  'chart-4': 'rgba(180, 120, 0, 1)',
  'chart-5': 'rgba(200, 40, 40, 1)',

  // Sidebar
  sidebar: 'rgba(248, 248, 250, 1)',
  'sidebar-foreground': 'rgba(15, 16, 18, 1)',
  'sidebar-primary': 'rgba(109, 108, 235, 1)',
  'sidebar-primary-foreground': 'rgba(255, 255, 255, 1)',
  'sidebar-accent': 'rgba(0, 0, 0, 0.06)',
  'sidebar-accent-foreground': 'rgba(15, 16, 18, 1)',
  'sidebar-border': 'rgba(0, 0, 0, 0.10)',
  'sidebar-ring': 'rgba(109, 108, 235, 1)',

  // Prompt input
  'prompt-bg': 'rgba(248, 248, 250, 1)',
  'prompt-border': 'rgba(0, 0, 0, 0.14)',
  'prompt-border-focus': 'rgba(109, 108, 235, 0.5)',

  // Primitives
  black: 'rgba(0, 0, 0, 1)',
  white: 'rgba(255, 255, 255, 1)',
} as const satisfies Record<ColorToken, string>;
