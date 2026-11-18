import { describe, expect, it } from 'vitest';

import { darkColors, lightColors } from '~/components/theme/tokens';

describe('glass bar tokens', () => {
  it('follow the color scheme: the bar fill is the glass fallback', () => {
    expect(lightColors.bar).toBe(lightColors.glassFallback);
    expect(darkColors.bar).toBe(darkColors.glassFallback);
  });

  it('draw bar text in the foreground color of each scheme', () => {
    expect(lightColors.barForeground).toBe(lightColors.foreground);
    expect(darkColors.barForeground).toBe(darkColors.foreground);
  });

  it('keep the accent chip the same violet in both schemes', () => {
    expect(darkColors.barAccent).toBe(lightColors.barAccent);
    expect(darkColors.barAccentForeground).toBe(lightColors.barAccentForeground);
  });
});
