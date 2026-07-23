import {
  colorThemes,
  radii,
  shadows as sharedShadows,
  spacing as sharedSpacing,
  transitionDurations,
  type ColorMode,
  type ColorTheme,
  type ColorToken,
  type RadiusToken,
  type SpacingToken,
} from '@ponti-studios/ui/tokens';

export { colorThemes, radii, sharedShadows as shadows, transitionDurations };
export type { ColorMode, ColorTheme, ColorToken, RadiusToken, SpacingToken };

/** Keep Omiro's existing numeric spacing call sites over the string-keyed shared scale. */
export const spacing: Record<number, number> = Object.fromEntries(
  Object.entries(sharedSpacing)
    .filter(([key]) => /^\d+$/.test(key))
    .map(([key, value]) => [Number(key), value]),
);

export const nativeShadows = Object.fromEntries(
  Object.entries(sharedShadows).map(([name, layers]) => [
    name,
    layers.map((layer) => ({
      color: layer.color,
      offsetX: layer.offsetX.value,
      offsetY: layer.offsetY.value,
      blurRadius: layer.blur.value,
      spreadDistance: layer.spread.value,
      inset: false,
    })),
  ]),
);

/** Non-react consumers must select a concrete system theme explicitly. */
export const colors = colorThemes.dark;
