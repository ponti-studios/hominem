import type { AppVariant } from './app-variant';

/**
 * App icon filenames used by app.config.ts at build time
 * (home screen icon, store listing, etc.).
 */
export const VARIANT_ICON_NAMES = Object.freeze({
  dev: 'icon.dev.png',
  e2e: 'icon.dev.png',
  preview: 'icon.preview.png',
  production: 'icon.png',
} as const satisfies Record<AppVariant, string>);

function normalizeAppVariant(variant: string): AppVariant {
  switch (variant) {
    case 'dev':
    case 'e2e':
    case 'preview':
    case 'production':
      return variant as AppVariant;
    default:
      return 'dev';
  }
}

function getBrandLogoAssetName(variant: string): string {
  return VARIANT_ICON_NAMES[normalizeAppVariant(variant)];
}

// Metro requires static string literals in require() — no template literals or variables.
// eslint-disable-next-line @typescript-eslint/no-require-imports
function getRuntimeBrandLogoSource(variant: string): number {
  switch (getBrandLogoAssetName(variant)) {
    case VARIANT_ICON_NAMES.preview:
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../assets/icon.preview.png');
    case VARIANT_ICON_NAMES.production:
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../assets/icon.png');
    default:
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../assets/icon.dev.png');
  }
}

export { getRuntimeBrandLogoSource };
