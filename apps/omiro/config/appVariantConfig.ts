export type AppVariant = 'dev' | 'e2e' | 'preview' | 'production';

export interface VariantConfig {
  bundleIdentifier: string;
  displayName: string;
  scheme: string;
  usesDevClient: boolean;
  updatesChannel: string | null;
}

const APP_VARIANTS = Object.freeze({
  dev: Object.freeze({
    bundleIdentifier: 'com.pontistudios.hakumi.dev',
    displayName: 'Omiro Dev',
    scheme: 'hakumi-dev',
    usesDevClient: true,
    updatesChannel: null,
  }),
  e2e: Object.freeze({
    bundleIdentifier: 'com.pontistudios.hakumi.e2e',
    displayName: 'Omiro E2E',
    scheme: 'hakumi-e2e',
    usesDevClient: false,
    updatesChannel: null,
  }),
  preview: Object.freeze({
    bundleIdentifier: 'com.pontistudios.hakumi.preview',
    displayName: 'Omiro Preview',
    scheme: 'hakumi-preview',
    usesDevClient: false,
    updatesChannel: 'preview',
  }),
  production: Object.freeze({
    bundleIdentifier: 'com.pontistudios.hakumi',
    displayName: 'Omiro',
    scheme: 'hakumi',
    usesDevClient: false,
    updatesChannel: 'production',
  }),
} as const satisfies Record<AppVariant, VariantConfig>);

export function getAppVariant(rawVariant = process.env.APP_VARIANT ?? 'dev'): AppVariant {
  if (Object.prototype.hasOwnProperty.call(APP_VARIANTS, rawVariant)) {
    return rawVariant as AppVariant;
  }

  throw new Error(`Unsupported APP_VARIANT: ${rawVariant}`);
}

export function getAppVariantConfig(rawVariant = process.env.APP_VARIANT ?? 'dev'): VariantConfig {
  return { ...APP_VARIANTS[getAppVariant(rawVariant)] };
}
