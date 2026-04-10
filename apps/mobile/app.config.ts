import type { ConfigContext, ExpoConfig } from 'expo/config';

import { getBrandAssetPaths } from './constants/brand-assets';
import type { AppVariant, VariantConfig } from './constants/app-variant';
import { getAppVariant, getAppVariantConfig } from './constants/app-variant';
import { EXPO_OWNER, EXPO_PROJECT_ID, getExpoExtraConfig } from './constants/expo-config';
import { shellTheme } from './constants/expo-theme';

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
  if (appVariant !== 'dev' && appVariant !== 'e2e') {
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
    [
      'expo-splash-screen',
      {
        backgroundColor: shellTheme.mobile.splashBackgroundColor,
        image: brandAssets.splash,
        resizeMode: 'cover',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '17.4',
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
