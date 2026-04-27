export type AppVariant = 'dev' | 'e2e' | 'preview' | 'production';

export interface VariantConfig {
  bundleIdentifier: string;
  displayName: string;
  scheme: string;
  usesDevClient: boolean;
  updatesChannel: string | null;
}

const appVariantModule = require('./appVariant.js') as {
  getAppVariant(rawVariant?: string): AppVariant;
  getAppVariantConfig(rawVariant?: string): VariantConfig;
};

export const getAppVariant = appVariantModule.getAppVariant;
export const getAppVariantConfig = appVariantModule.getAppVariantConfig;
