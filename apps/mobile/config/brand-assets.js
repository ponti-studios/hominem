const ROOT_ASSETS_DIR = '../../assets'
const SPLASH_ASSET_NAME = 'logo.hakumi.splash-screen.png'
const FAVICON_ASSET_NAME = 'logo.hakumi.png'

const VARIANT_LOGO_ASSET_NAMES = Object.freeze({
  dev: 'logo.hakumi.dev.png',
  e2e: 'logo.hakumi.dev.png',
  preview: 'logo.hakumi.preview.png',
  production: 'logo.hakumi.png',
})

function joinRootAssetPath(assetName) {
  return `${ROOT_ASSETS_DIR}/${assetName}`
}

function normalizeAppVariant(variant) {
  switch (variant) {
    case 'dev':
    case 'e2e':
    case 'preview':
    case 'production':
      return variant
    default:
      return 'dev'
  }
}

function getBrandLogoAssetName(variant) {
  return VARIANT_LOGO_ASSET_NAMES[normalizeAppVariant(variant)]
}

function getBrandAssetPaths(variant) {
  const icon = joinRootAssetPath(getBrandLogoAssetName(variant))

  return {
    favicon: joinRootAssetPath(FAVICON_ASSET_NAME),
    icon,
    splash: joinRootAssetPath(SPLASH_ASSET_NAME),
  }
}

function getRuntimeBrandLogoSource(variant) {
  switch (getBrandLogoAssetName(variant)) {
    case 'logo.hakumi.preview.png':
      return require('../../../assets/logo.hakumi.preview.png')
    case 'logo.hakumi.png':
      return require('../../../assets/logo.hakumi.png')
    default:
      return require('../../../assets/logo.hakumi.dev.png')
  }
}

module.exports = {
  getBrandAssetPaths,
  getBrandLogoAssetName,
  getRuntimeBrandLogoSource,
  normalizeAppVariant,
}
