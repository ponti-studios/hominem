export type AppVariant = 'dev' | 'e2e' | 'preview' | 'production'

export function getBrandAssetPaths(variant: AppVariant): {
  favicon: string
  icon: string
  splash: string
}

export function getBrandLogoAssetName(variant: string | undefined): string

export function getRuntimeBrandLogoSource(variant: string | undefined): number

export function normalizeAppVariant(variant: string | undefined): AppVariant
