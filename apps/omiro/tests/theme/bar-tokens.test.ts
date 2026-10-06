import { describe, expect, it } from 'vitest';

import { darkColors, lightColors, shadows } from '~/components/theme/tokens';

describe('composer bar tokens', () => {
  it('are identical in light and dark mode', () => {
    expect(darkColors.bar).toBe(lightColors.bar);
    expect(darkColors.barForeground).toBe(lightColors.barForeground);
    expect(darkColors.barAccent).toBe(lightColors.barAccent);
    expect(darkColors.barAccentForeground).toBe(lightColors.barAccentForeground);
  });

  it('keep the bar dark with white text', () => {
    expect(lightColors.bar).toBe('#14121F');
    expect(lightColors.barForeground).toBe('#FFFFFF');
  });

  it('give the bar a 1px ring on top of the float shadow', () => {
    expect(shadows.bar).toHaveLength(2);
    expect(shadows.bar[0]).toMatchObject({ spreadDistance: 1, blurRadius: 0 });
  });
});
