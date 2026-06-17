import type { ConfigContext, ExpoConfig } from 'expo/config';
import appVariantModule from './config/appVariant.js';
import type { AppVariant, VariantConfig } from './config/appVariantConfig';

const { getAppVariant, getAppVariantConfig } = appVariantModule as {
  getAppVariant(rawVariant?: string): AppVariant;
  getAppVariantConfig(rawVariant?: string): VariantConfig;
};

const EXPO_OWNER = 'pontistudios';
const EXPO_PROJECT_ID = '4dfac82b-644f-4ff3-be42-e8f941287aa1';
const APPLE_TEAM_ID = '3QHJ2KN8AL';

const shellTheme = {
  mobile: {
    splashBackgroundColor: '#000000',
    notificationColor: '#000000',
  },
} as const;

const ROOT_ASSETS_DIR = './assets';

function getBrandAssetPaths(variant: AppVariant): { icon: string; splash: string } {
  const icon = `${ROOT_ASSETS_DIR}/${VARIANT_ICON_NAMES[variant]}`;
  return {
    icon,
    splash: `${ROOT_ASSETS_DIR}/logo.splash-screen.png`,
  };
}

function getExpoExtraConfig(
  env: Record<string, string | undefined>,
): {
  apiBaseUrl: string;
  mobilePasskeyEnabled: string;
  posthogApiKey: string;
  posthogHost: string;
} {
  const getEnvValue = (value: string | undefined, fallback: string): string => value ?? fallback;
  return {
    apiBaseUrl: getEnvValue(env.EXPO_PUBLIC_API_BASE_URL, ''),
    mobilePasskeyEnabled: getEnvValue(env.EXPO_PUBLIC_MOBILE_PASSKEY_ENABLED, 'false'),
    posthogApiKey: getEnvValue(env.EXPO_PUBLIC_POSTHOG_API_KEY, ''),
    posthogHost: getEnvValue(env.EXPO_PUBLIC_POSTHOG_HOST, 'https://us.i.posthog.com'),
  };
}

function getAppleTeamId() {
  return process.env.EXPO_APPLE_TEAM_ID ?? APPLE_TEAM_ID;
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
    'expo-font',
    'expo-localization',
    'expo-web-browser',
    'expo-asset',
    'expo-audio',
    [
      'expo-notifications',
      {
        color: shellTheme.mobile.notificationColor,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Allow Omiro to access your camera to capture photos for notes.',
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission: 'Allow Omiro to save photos to your library.',
        savePhotosPermission: 'Allow Omiro to save photos to your library.',
        isAccessMediaLocationEnabled: false,
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Allow Omiro to use Face ID to lock your app.',
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
    platforms: ['ios'],
    orientation: 'portrait',
    icon: brandAssets.icon,
    userInterfaceStyle: 'light',
    assetBundlePatterns: ['assets/**/*', 'api/**/*', 'app/**/*', 'constants/**/*', 'hooks/**/*', 'navigation/**/*', 'services/**/*'],
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
        'keychain-access-groups': [`$(AppIdentifierPrefix)${variantConfig.bundleIdentifier}`],
      },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          'Omiro may use your location only when you choose media that includes location details, so it can preserve context for your notes.',
        NSMicrophoneUsageDescription:
          'Allow Omiro to access your microphone to record voice notes on your device.',
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
