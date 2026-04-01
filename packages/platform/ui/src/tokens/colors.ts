/**
 * Canonical color tokens.
 *
 * Values MUST match the @theme block in packages/ui/src/styles/globals.css.
 * Web consumes these via CSS custom properties; other platforms (e.g. mobile
 * Restyle) import this file directly.
 */

export const colors = {
  // Backgrounds — light palette per Apple HIG
  'bg-base': '#ffffff',
  'bg-surface': '#f5f5f7',
  'bg-elevated': '#f2f2f7',
  'bg-overlay': 'rgba(0, 0, 0, 0.04)',

  // Text — dark foreground per Apple HIG
  'text-primary': '#000000',
  'text-secondary': '#555555',
  'text-tertiary': '#888888',
  'text-disabled': '#cccccc',

  // Borders — opacity scale on black
  'border-default': 'rgba(0, 0, 0, 0.1)',
  'border-subtle': 'rgba(0, 0, 0, 0.05)',
  'border-focus': 'rgba(0, 0, 0, 0.15)',

  // Icons
  'icon-primary': '#000000',
  'icon-muted': '#888888',

  // Semantic status
  success: '#34c759',
  warning: '#ff9500',
  destructive: '#ff3b30',
  'destructive-muted': 'rgba(255, 59, 48, 0.65)',

  // Accent (Apple Blue per HIG; can be overridden per-product)
  accent: '#007AFF',
  'accent-foreground': '#ffffff',

  // Vendor colors
  'google-maps-blue': '#4285F4', // Google Maps standard marker color

  // System / backward-compat aliases
  primary: '#000000',
  'primary-foreground': '#ffffff',
  secondary: 'rgba(0, 0, 0, 0.1)',
  'secondary-foreground': '#555555',
  muted: 'rgba(0, 0, 0, 0.05)',
  'muted-foreground': '#888888',
  foreground: '#000000',
  background: '#ffffff',
  'destructive-foreground': '#ffffff',
  popover: '#f5f5f7',
  'popover-foreground': '#000000',
  input: '#f5f5f7',
  ring: '#007AFF',

  // Emphasis scale — opacity layers on black
  'emphasis-highest': 'rgba(0, 0, 0, 0.9)',
  'emphasis-high': 'rgba(0, 0, 0, 0.7)',
  'emphasis-medium': 'rgba(0, 0, 0, 0.5)',
  'emphasis-low': 'rgba(0, 0, 0, 0.3)',
  'emphasis-lower': 'rgba(0, 0, 0, 0.2)',
  'emphasis-subtle': 'rgba(0, 0, 0, 0.15)',
  'emphasis-minimal': 'rgba(0, 0, 0, 0.1)',
  'emphasis-faint': 'rgba(0, 0, 0, 0.05)',

  // Modal overlays — darkens background for sheet/modal UI
  'overlay-modal-high': 'rgba(0, 0, 0, 0.6)',
  'overlay-modal-medium': 'rgba(0, 0, 0, 0.45)',

  // Charts — opacity scale on black
  'chart-1': 'rgba(0, 0, 0, 0.9)',
  'chart-2': 'rgba(0, 0, 0, 0.7)',
  'chart-3': 'rgba(0, 0, 0, 0.5)',
  'chart-4': 'rgba(0, 0, 0, 0.3)',
  'chart-5': 'rgba(0, 0, 0, 0.15)',

  // Sidebar — ChatGPT-style light sidebar
  sidebar: '#f9f9f9',
  'sidebar-foreground': '#0d0d0d',
  'sidebar-primary': '#0d0d0d',
  'sidebar-primary-foreground': '#ffffff',
  'sidebar-accent': 'rgba(0, 0, 0, 0.06)',
  'sidebar-accent-foreground': '#0d0d0d',
  'sidebar-border': 'rgba(0, 0, 0, 0.08)',
  'sidebar-ring': '#0d0d0d',

  // Prompt input
  'prompt-bg': '#ffffff',
  'prompt-border': 'rgba(0, 0, 0, 0.15)',
  'prompt-border-focus': 'rgba(0, 0, 0, 0.25)',

  // Primitive values used by mobile shadow system
  black: '#000000',
  white: '#ffffff',
} as const;

export const darkColors = {
  ...colors,
  'bg-base': '#1A1814',
  'bg-surface': '#242019',
  'bg-elevated': '#2E2A22',
  'bg-overlay': 'rgba(250, 249, 247, 0.04)',

  'text-primary': '#F5F2EC',
  'text-secondary': '#A89F90',
  'text-tertiary': '#6B6555',
  'text-disabled': '#3E3B35',

  'border-default': 'rgba(250, 249, 247, 0.09)',
  'border-subtle': 'rgba(250, 249, 247, 0.05)',
  'border-focus': 'rgba(250, 249, 247, 0.20)',

  'icon-primary': '#F5F2EC',
  'icon-muted': '#6B6555',

  success: '#34C47A',
  warning: '#F59E0B',
  destructive: '#F05252',

  accent: '#E0703A',
  'accent-foreground': '#FFFFFF',

  primary: '#F5F2EC',
  'primary-foreground': '#1A1814',
  secondary: 'rgba(250, 249, 247, 0.08)',
  'secondary-foreground': '#A89F90',
  muted: 'rgba(250, 249, 247, 0.05)',
  'muted-foreground': '#6B6555',
  foreground: '#F5F2EC',
  background: '#1A1814',
  'destructive-foreground': '#FFFFFF',
  popover: '#242019',
  'popover-foreground': '#F5F2EC',
  input: '#242019',
  ring: '#E0703A',

  'emphasis-highest': 'rgba(250, 249, 247, 0.90)',
  'emphasis-high': 'rgba(250, 249, 247, 0.70)',
  'emphasis-medium': 'rgba(250, 249, 247, 0.50)',
  'emphasis-low': 'rgba(250, 249, 247, 0.30)',
  'emphasis-lower': 'rgba(250, 249, 247, 0.20)',
  'emphasis-subtle': 'rgba(250, 249, 247, 0.12)',
  'emphasis-minimal': 'rgba(250, 249, 247, 0.07)',
  'emphasis-faint': 'rgba(250, 249, 247, 0.04)',

  'chart-1': '#C05A2A',
  'chart-2': '#2A9D63',
  'chart-3': '#3B82F6',
  'chart-4': '#D97706',
  'chart-5': '#9E9585',

  sidebar: '#1A1814',
  'sidebar-foreground': '#F5F2EC',
  'sidebar-primary': '#F5F2EC',
  'sidebar-primary-foreground': '#1A1814',
  'sidebar-accent': 'rgba(250, 249, 247, 0.06)',
  'sidebar-accent-foreground': '#F5F2EC',
  'sidebar-border': 'rgba(250, 249, 247, 0.08)',
  'sidebar-ring': '#E0703A',

  'prompt-bg': '#242019',
  'prompt-border': 'rgba(250, 249, 247, 0.12)',
  'prompt-border-focus': 'rgba(250, 249, 247, 0.28)',
} as const;

export type ColorToken = keyof typeof colors;
export type DarkColorToken = keyof typeof darkColors;
