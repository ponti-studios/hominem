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
});

function getAppVariant(rawVariant = process.env.APP_VARIANT ?? 'dev') {
  if (Object.prototype.hasOwnProperty.call(APP_VARIANTS, rawVariant)) {
    return rawVariant;
  }

  throw new Error(`Unsupported APP_VARIANT: ${rawVariant}`);
}

function getAppVariantConfig(rawVariant = process.env.APP_VARIANT ?? 'dev') {
  return { ...APP_VARIANTS[getAppVariant(rawVariant)] };
}

module.exports = {
  getAppVariant,
  getAppVariantConfig,
};
