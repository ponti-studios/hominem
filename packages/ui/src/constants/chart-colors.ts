/**
 * Chart colors are CSS-variable-backed so they stay in sync with the active
 * color system and mode at runtime.
 */

export const CHART_COLORS = {
  chart1: "var(--color-chart-1)",
  chart2: "var(--color-chart-2)",
  chart3: "var(--color-chart-3)",
  chart4: "var(--color-chart-4)",
  chart5: "var(--color-chart-5)",

  positive: "var(--color-chart-positive)",
  negative: "var(--color-chart-negative)",
  neutral: "var(--color-chart-neutral)",

  background: "var(--color-bg-base)",
  grid: "var(--color-border-subtle)",

  axis: "var(--color-text-tertiary)",
  label: "var(--color-text-secondary)",

  tooltip: {
    background: "var(--color-card)",
    text: "var(--color-text-primary)",
    border: "var(--color-border-default)",
  },
} as const;

export const CHART_CSS_VARS = {
  positive: "var(--color-chart-positive)",
  negative: "var(--color-chart-negative)",
  neutral: "var(--color-chart-neutral)",
  chart1: "var(--color-chart-1)",
  chart2: "var(--color-chart-2)",
  chart3: "var(--color-chart-3)",
  chart4: "var(--color-chart-4)",
  chart5: "var(--color-chart-5)",
} as const;
