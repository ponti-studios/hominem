import type { AppVariant } from './app-variant';

const VARIANT_LOGO_ASSET_NAMES: Record<AppVariant, string> = Object.freeze({
  dev: 'logo.hakumi.dev.png',
  e2e: 'logo.hakumi.dev.png',
  preview: 'logo.hakumi.preview.png',
  production: 'logo.hakumi.png',
});

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
  return VARIANT_LOGO_ASSET_NAMES[normalizeAppVariant(variant)];
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
function getRuntimeBrandLogoSource(variant: string): number {
  switch (getBrandLogoAssetName(variant)) {
    case 'logo.hakumi.preview.png':
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../assets/logo.hakumi.preview.png');
    case 'logo.hakumi.png':
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../assets/logo.hakumi.png');
    default:
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../assets/logo.hakumi.dev.png');
  }
}

export { getRuntimeBrandLogoSource };
