export type AppVariant = 'dev' | 'e2e' | 'preview' | 'production';

export interface VariantConfig {
  bundleIdentifier: string;
  displayName: string;
  scheme: string;
  usesDevClient: boolean;
  updatesChannel: string | null;
}

export function getAppVariant(rawVariant?: string): AppVariant;
export function getAppVariantConfig(rawVariant?: string): VariantConfig;
