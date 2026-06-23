import { colors } from '../tokens';

/**
 * Chart Colors for Dark Luxury Design System
 *
 * Use these constants for consistent chart styling across the application.
 * All colors reference the canonical color system for cohesion.
 */

export const CHART_COLORS = {
  /** Primary luxury colors for multi-category charts */
  chart1: colors['chart-1'],
  chart2: colors['chart-2'],
  chart3: colors['chart-3'],
  chart4: colors['chart-4'],
  chart5: colors['chart-5'],

  /** Semantic chart colors for meaning-based visualization */
  positive: colors.success,
  negative: colors.destructive,
  neutral: colors['text-secondary'],

  /** Chart background and grid */
  background: colors['bg-base'],
  grid: colors['border-subtle'],

  /** Axis and label colors */
  axis: colors['text-tertiary'],
  label: colors['text-secondary'],

  /** Tooltip styling */
  tooltip: {
    background: colors['text-primary'],
    text: colors['bg-base'],
    border: colors['border-default'],
  },
} as const;

/** CSS custom property references for use in inline styles */
export const CHART_CSS_VARS = {
  positive: 'var(--color-chart-positive)',
  negative: 'var(--color-chart-negative)',
  neutral: 'var(--color-chart-neutral)',
  chart1: 'var(--color-chart-1)',
  chart2: 'var(--color-chart-2)',
  chart3: 'var(--color-chart-3)',
  chart4: 'var(--color-chart-4)',
  chart5: 'var(--color-chart-5)',
} as const;
