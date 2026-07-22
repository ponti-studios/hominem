import {
  colorThemes,
  radii,
  shadows,
  spacing as sharedSpacing,
  transitionDurations,
  type ColorMode,
  type ColorTheme,
  type ColorToken,
  type RadiusToken,
  type SpacingToken,
} from '@ponti-studios/ui/tokens';

export { colorThemes, radii, shadows, transitionDurations };
export type { ColorMode, ColorTheme, ColorToken, RadiusToken, SpacingToken };

/** Keep Omiro's existing numeric spacing call sites over the string-keyed shared scale. */
export const spacing: Record<number, number> = Object.fromEntries(
  Object.entries(sharedSpacing)
    .filter(([key]) => /^\d+$/.test(key))
    .map(([key, value]) => [Number(key), value]),
);

const toPixels = (value: { value: number; unit: string }) => value.value;
export const nativeShadows = Object.fromEntries(
  Object.entries(shadows).map(([name, layers]) => [name, layers.map((layer) => ({
    color: layer.color,
    offsetX: toPixels(layer.offsetX),
    offsetY: toPixels(layer.offsetY),
    blurRadius: toPixels(layer.blur),
    spreadDistance: toPixels(layer.spread),
    inset: false,
  }))]),
);

/** Non-react consumers must select a concrete system theme explicitly. */
export const colors = colorThemes.dark;
