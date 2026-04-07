import {
  getBrandAssetPaths,
  getBrandLogoAssetName,
  getRuntimeBrandLogoSource,
  normalizeAppVariant,
} from '../config/brand-assets'

describe('brand assets', () => {
  it.each([
    ['dev', 'logo.hakumi.dev.png'],
    ['e2e', 'logo.hakumi.dev.png'],
    ['preview', 'logo.hakumi.preview.png'],
    ['production', 'logo.hakumi.png'],
  ] as const)('maps %s to the correct runtime logo asset', (variant, expected) => {
    expect(getBrandLogoAssetName(variant)).toBe(expected)
  })

  it('falls back unknown variants to dev branding', () => {
    expect(normalizeAppVariant('unexpected')).toBe('dev')
    expect(getBrandLogoAssetName('unexpected')).toBe('logo.hakumi.dev.png')
  })

  it('builds Expo asset paths from the shared branding contract', () => {
    expect(getBrandAssetPaths('preview')).toEqual({
      favicon: './assets/logo.hakumi.png',
      icon: './assets/logo.hakumi.preview.png',
      splash: './assets/logo.hakumi.splash-screen.png',
    })
  })

  it('returns distinct runtime image sources for each branded logo', () => {
    expect(getRuntimeBrandLogoSource('dev')).toBeTruthy()
    expect(getRuntimeBrandLogoSource('preview')).toBeTruthy()
    expect(getRuntimeBrandLogoSource('production')).toBeTruthy()
    expect(getRuntimeBrandLogoSource('preview')).not.toBe(getRuntimeBrandLogoSource('production'))
  })
})
