import { describe, expect, it } from 'vitest';

import { darkColors, lightColors } from '~/components/theme/tokens';

function luminance(hex: string) {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_TEXT = 4.5;

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
])('%s palette contrast', (_mode, colors) => {
  it('keeps body and muted text readable on the ground and on cards', () => {
    expect(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(colors.foreground, colors.card)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(colors.mutedForeground, colors.background)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(colors.mutedForeground, colors.card)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('keeps text on action, ink and lime fills readable', () => {
    expect(contrast(colors.primaryForeground, colors.primary)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(colors.inkForeground, colors.ink)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(colors.limeForeground, colors.lime)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(colors.destructive, colors.card)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('keeps event text readable on every pastel fill', () => {
    for (const fill of [colors.eventViolet, colors.eventCoral, colors.eventSky, colors.eventSun]) {
      expect(contrast(colors.eventForeground, fill)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});
