import type { ConfigContext, ExpoConfig } from 'expo/config';

const EXPO_OWNER = 'pontistudios';
const EXPO_PROJECT_ID = '4dfac82b-644f-4ff3-be42-e8f941287aa1';

const shellTheme = {
  mobile: {
    splashBackgroundColor: '#000000',
    htmlBackgroundColor: '#000000',
    adaptiveIconBackgroundColor: '#000000',
    notificationColor: '#000000',
  },
} as const;

type AppVariant = 'dev' | 'e2e' | 'preview' | 'production';

interface VariantConfig {
  bundleIdentifier: string;
  displayName: string;
  scheme: string;
  usesDevClient: boolean;
  updatesChannel: string | null;
}

const APP_VARIANTS: Readonly<Record<AppVariant, Readonly<VariantConfig>>> = Object.freeze({
  dev: Object.freeze({
    bundleIdentifier: 'com.pontistudios.hakumi.dev',
    displayName: 'Hakumi Dev',
    scheme: 'hakumi-dev',
    usesDevClient: true,
    updatesChannel: null,
  }),
  e2e: Object.freeze({
    bundleIdentifier: 'com.pontistudios.hakumi.e2e',
    displayName: 'Hakumi E2E',
    scheme: 'hakumi-e2e',
    usesDevClient: false,
    updatesChannel: null,
  }),
  preview: Object.freeze({
    bundleIdentifier: 'com.pontistudios.hakumi.preview',
    displayName: 'Hakumi Preview',
    scheme: 'hakumi-preview',
    usesDevClient: false,
    updatesChannel: 'preview',
  }),
  production: Object.freeze({
    bundleIdentifier: 'com.pontistudios.hakumi',
    displayName: 'Hakumi',
    scheme: 'hakumi',
    usesDevClient: false,
    updatesChannel: 'production',
  }),
});

function getAppVariant(rawVariant = process.env.APP_VARIANT ?? 'dev'): AppVariant {
  if (Object.prototype.hasOwnProperty.call(APP_VARIANTS, rawVariant)) {
    return rawVariant as AppVariant;
  }
  throw new Error(`Unsupported APP_VARIANT: ${rawVariant}`);
}

function getAppVariantConfig(rawVariant = process.env.APP_VARIANT ?? 'dev'): VariantConfig {
  return { ...APP_VARIANTS[getAppVariant(rawVariant)] };
}

const ROOT_ASSETS_DIR = './assets';

function getBrandAssetPaths(variant: AppVariant): { favicon: string; icon: string; splash: string } {
  const icon = `${ROOT_ASSETS_DIR}/${VARIANT_ICON_NAMES[variant]}`;
  return {
    favicon: `${ROOT_ASSETS_DIR}/icon.png`,
    icon,
    splash: `${ROOT_ASSETS_DIR}/logo.splash-screen.png`,
  };
}

function getExpoExtraConfig(
  env: Record<string, string | undefined>,
): {
  apiBaseUrl: string;
  e2eAuthSecret: string;
  mobilePasskeyEnabled: string;
  posthogApiKey: string;
  posthogHost: string;
} {
  const getEnvValue = (value: string | undefined, fallback: string): string => value ?? fallback;
  return {
    apiBaseUrl: getEnvValue(env.EXPO_PUBLIC_API_BASE_URL, ''),
    e2eAuthSecret: getEnvValue(env.EXPO_PUBLIC_E2E_AUTH_SECRET, ''),
    mobilePasskeyEnabled: getEnvValue(env.EXPO_PUBLIC_MOBILE_PASSKEY_ENABLED, 'false'),
    posthogApiKey: getEnvValue(env.EXPO_PUBLIC_POSTHOG_API_KEY, ''),
    posthogHost: getEnvValue(env.EXPO_PUBLIC_POSTHOG_HOST, 'https://us.i.posthog.com'),
  };
}

function getAppleTeamId() {
  return process.env.EXPO_APPLE_TEAM_ID;
}

function getUpdatesConfig(variantConfig: VariantConfig): ExpoConfig['updates'] {
  if (variantConfig.usesDevClient || variantConfig.updatesChannel === null) {
    return {
      enabled: false,
      checkAutomatically: 'NEVER',
      fallbackToCacheTimeout: 0,
    };
  }

  return {
    url: `https://u.expo.dev/${EXPO_PROJECT_ID}`,
    requestHeaders: {
      'expo-channel-name': variantConfig.updatesChannel,
    },
  };
}

function allowsLocalNetworking(appVariant: AppVariant) {
  return appVariant !== 'production';
}

function getAppGroupId(bundleIdentifier: string) {
  return `group.${bundleIdentifier}`;
}

export default ({ config }: ConfigContext) => {
  const appVariant = getAppVariant();
  const variantConfig = getAppVariantConfig(appVariant);
  const brandAssets = getBrandAssetPaths(appVariant);
  const plugins: ExpoConfig['plugins'] = [
    'expo-router',
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '15.1',
          infoPlist: {
            NSAppTransportSecurity: {
              NSAllowsArbitraryLoads: false,
              NSAllowsLocalNetworking: allowsLocalNetworking(appVariant),
            },
          },
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: shellTheme.mobile.splashBackgroundColor,
        image: brandAssets.splash,
        enableFullScreenImage_legacy: true,
        resizeMode: 'cover',
      },
    ],
    ['expo-secure-store'],
    'expo-localization',
    'expo-web-browser',
    'expo-asset',
    'expo-audio',
    'expo-sqlite',
    [
      'expo-notifications',
      {
        color: shellTheme.mobile.notificationColor,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Allow Hakumi to access your camera to capture photos for notes.',
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission: 'Allow Hakumi to save photos to your library.',
        savePhotosPermission: 'Allow Hakumi to save photos to your library.',
        isAccessMediaLocationEnabled: false,
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Allow Hakumi to use Face ID to lock your app.',
      },
    ],
    [
      'react-native-vision-camera',
      {
        cameraPermissionText: 'Allow Hakumi to access your camera to capture photos for notes.',
        enableMicrophonePermission: false,
      },
    ],
  ];

  if (appVariant !== 'e2e') {
    plugins.push('./plugins/with-widget-bundle-update');
    plugins.push('@bacons/apple-targets');
  }

  if (variantConfig.usesDevClient) {
    plugins.splice(1, 0, [
      'expo-dev-client',
      {
        launchMode: 'most-recent',
      },
    ]);
  }

  const extraConfig = getExpoExtraConfig(process.env);

  return {
    ...config,
    name: variantConfig.displayName,
    slug: 'hakumi',
    version: '1.0.0',
    scheme: variantConfig.scheme,
    owner: EXPO_OWNER,
    orientation: 'portrait',
    icon: brandAssets.icon,
    userInterfaceStyle: 'light',
    assetBundlePatterns: ['assets/**/*', 'api/**/*', 'app/**/*', 'constants/**/*', 'hooks/**/*', 'navigation/**/*', 'services/**/*'],
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: brandAssets.favicon,
    },
    plugins,
    experiments: {
      tsconfigPaths: true,
    },
    newArchEnabled: true,
    ios: {
      appleTeamId: getAppleTeamId(),
      icon: brandAssets.icon,
      bundleIdentifier: variantConfig.bundleIdentifier,
      supportsTablet: true,
      entitlements: {
        'com.apple.developer.siri': true,
        'com.apple.security.application-groups': [getAppGroupId(variantConfig.bundleIdentifier)],
        'keychain-access-groups': [`$(AppIdentifierPrefix)${variantConfig.bundleIdentifier}`],
      },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSMicrophoneUsageDescription:
          'Allow Hakumi to access your microphone to transcribe voice notes.',
      },
    },
    extra: {
      appVariant,
      appScheme: variantConfig.scheme,
      isDevClient: variantConfig.usesDevClient,
      ...extraConfig,
      eas: {
        projectId: EXPO_PROJECT_ID,
      },
    },
    runtimeVersion: {
      policy: 'fingerprint',
    },
    updates: getUpdatesConfig(variantConfig),
  };
};
const VARIANT_ICON_NAMES = Object.freeze({
  dev: 'icon.dev.png',
  e2e: 'icon.dev.png',
  preview: 'icon.preview.png',
  production: 'icon.png',
} as const satisfies Record<AppVariant, string>);
