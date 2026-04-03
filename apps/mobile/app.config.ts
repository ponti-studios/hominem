import type { ConfigContext, ExpoConfig } from 'expo/config';
import { getBrandAssetPaths, type AppVariant } from './config/brand-assets';

interface VariantConfig {
  bundleIdentifier: string;
  displayName: string;
  updatesChannel: string | null;
  scheme: string;
  usesDevClient: boolean;
}

const { getAppVariant, getAppVariantConfig } = require('./config/appVariant') as {
  getAppVariant: () => AppVariant;
  getAppVariantConfig: (rawVariant?: string) => VariantConfig;
};

const { EXPO_OWNER, EXPO_PROJECT_ID, getExpoExtraConfig } = require('./config/expo-config.js') as {
  EXPO_OWNER: string;
  EXPO_PROJECT_ID: string;
  getExpoExtraConfig: (env: Record<string, string | undefined>) => {
    apiBaseUrl: string;
    e2eTesting: string;
    e2eAuthSecret: string;
    mobilePasskeyEnabled: string;
  };
};

const { shellTheme } = require('./config/expo-theme.js') as {
  shellTheme: {
    mobile: {
      adaptiveIconBackgroundColor: string;
      htmlBackgroundColor: string;
      notificationColor: string;
      splashBackgroundColor: string;
    };
  };
};

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

function getAppleTeamId(appVariant: AppVariant) {
  if (appVariant !== 'dev') {
    return undefined;
  }

  return process.env.EXPO_APPLE_TEAM_ID;
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
    './plugins/with-expo-dev-client-exclusion',
    [
      'expo-splash-screen',
      {
        backgroundColor: shellTheme.mobile.splashBackgroundColor,
        image: brandAssets.splash,
        resizeMode: 'contain',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '18.0',
          infoPlist: {
            NSAppTransportSecurity: {
              NSAllowsArbitraryLoads: false,
              NSAllowsLocalNetworking: allowsLocalNetworking(appVariant),
              ...(appVariant !== 'production' && {
                NSExceptionDomains: {
                  'railway.app': {
                    NSExceptionRequiresForwardSecrecy: true,
                    NSIncludesSubdomains: true,
                  },
                },
              }),
            },
          },
        },
      },
    ],
    [
      'expo-font',
      {
        fonts: [
          './assets/fonts/GeistMono-Regular.ttf',
          './assets/fonts/GeistMono-SemiBold.ttf',
          './assets/fonts/icons/fa-regular-400.ttf',
        ],
      },
    ],
    ['expo-secure-store'],
    'expo-localization',
    'expo-web-browser',
    'expo-asset',
    'expo-audio',
    'expo-sqlite',
    'expo-background-task',
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
    './plugins/with-widget-bundle-update',
    './plugins/with-app-intents',
    '@bacons/apple-targets',
  ];

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
    assetBundlePatterns: ['**/*'],
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: brandAssets.favicon,
    },
    plugins,
    experiments: {
      typedRoutes: true,
      tsconfigPaths: true,
    },
    newArchEnabled: true,
    ios: {
      icon: brandAssets.icon,
      appleTeamId: getAppleTeamId(appVariant),
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
    android: {
      adaptiveIcon: {
        foregroundImage: brandAssets.icon,
        backgroundColor: shellTheme.mobile.adaptiveIconBackgroundColor,
      },
      package: variantConfig.bundleIdentifier,
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
