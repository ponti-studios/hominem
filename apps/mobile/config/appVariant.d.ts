export type AppVariant = 'dev' | 'e2e' | 'preview' | 'production';

export interface VariantConfig {
  bundleIdentifier: string;
  displayName: string;
  scheme: string;
  usesDevClient: boolean;
  updatesChannel: string | null;
}

export const DEV_CLIENT_EXCLUDED_MODULES: readonly string[];
export const APP_VARIANTS: Readonly<Record<AppVariant, Readonly<VariantConfig>>>;

export function getAppVariant(rawVariant?: string): AppVariant;
export function getAppVariantConfig(rawVariant?: string): VariantConfig;
export function getPodfileUseExpoModulesLine(rawVariant?: string): string;
