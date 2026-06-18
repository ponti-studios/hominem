import type { ConfigContext, ExpoConfig } from 'expo/config';

const EXPO_OWNER = 'pontistudios';
const EXPO_PROJECT_ID = '4dfac82b-644f-4ff3-be42-e8f941287aa1';
const APPLE_TEAM_ID = '3QHJ2KN8AL';
const DEFAULT_RUNTIME_VERSION = 'ios-r1';
const RELEASE_CHANNELS = ['staging', 'production'] as const;
const APP_ENVIRONMENTS = Object.freeze({
  development: Object.freeze({
    bundleIdentifier: 'com.pontistudios.hakumi.dev',
    displayName: 'Omiro Dev',
    scheme: 'hakumi-dev',
  }),
  production: Object.freeze({
    bundleIdentifier: 'com.pontistudios.hakumi',
    displayName: 'Omiro',
    scheme: 'hakumi',
  }),
} as const);

const shellTheme = {
  mobile: {
    splashBackgroundColor: '#000000',
    notificationColor: '#000000',
  },
} as const;

const ROOT_ASSETS_DIR = './assets';

type AppEnvironment = keyof typeof APP_ENVIRONMENTS;
type AppEnvironmentConfig = (typeof APP_ENVIRONMENTS)[AppEnvironment];
type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

function getBrandAssetPaths(appEnvironment: AppEnvironment): { icon: string; splash: string } {
  const icon = `${ROOT_ASSETS_DIR}/${ENVIRONMENT_ICON_NAMES[appEnvironment]}`;
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

function getAppEnvironment(rawEnvironment = process.env.APP_ENV ?? 'development'): AppEnvironment {
  if (Object.prototype.hasOwnProperty.call(APP_ENVIRONMENTS, rawEnvironment)) {
    return rawEnvironment as AppEnvironment;
  }

  throw new Error(`Unsupported APP_ENV: ${rawEnvironment}`);
}

function getAppEnvironmentConfig(
  rawEnvironment = process.env.APP_ENV ?? 'development',
): AppEnvironmentConfig {
  return APP_ENVIRONMENTS[getAppEnvironment(rawEnvironment)];
}

function getReleaseChannel(rawChannel = process.env.OMIRO_RELEASE_CHANNEL): ReleaseChannel | null {
  if (!rawChannel) {
    return null;
  }

  if (RELEASE_CHANNELS.includes(rawChannel as ReleaseChannel)) {
    return rawChannel as ReleaseChannel;
  }

  throw new Error(`Unsupported OMIRO_RELEASE_CHANNEL: ${rawChannel}`);
}

function usesDevelopmentClient(appEnvironment: AppEnvironment) {
  return appEnvironment === 'development' && process.env.OMIRO_DEV_CLIENT !== 'false';
}

function isE2ETestingEnabled() {
  return process.env.EXPO_PUBLIC_E2E_TESTING === 'true';
}

function getRuntimeVersion(appEnvironment: AppEnvironment): string | null {
  if (appEnvironment !== 'production') {
    return null;
  }

  const runtimeVersion = process.env.EXPO_RUNTIME_VERSION?.trim();
  if (runtimeVersion) {
    return runtimeVersion;
  }

  return DEFAULT_RUNTIME_VERSION;
}

function getUpdatesConfig(
  appEnvironment: AppEnvironment,
  releaseChannel: ReleaseChannel | null,
): ExpoConfig['updates'] {
  if (appEnvironment !== 'production') {
    return {
      enabled: false,
      checkAutomatically: 'NEVER',
      fallbackToCacheTimeout: 0,
    };
  }

  if (releaseChannel === null) {
    throw new Error('OMIRO_RELEASE_CHANNEL is required when APP_ENV=production.');
  }

  return {
    url: `https://u.expo.dev/${EXPO_PROJECT_ID}`,
    requestHeaders: {
      'expo-channel-name': releaseChannel,
    },
  };
}

function allowsLocalNetworking(appEnvironment: AppEnvironment) {
  return appEnvironment === 'development';
}

export default ({ config }: ConfigContext) => {
  const appEnvironment = getAppEnvironment();
  const appEnvironmentConfig = getAppEnvironmentConfig(appEnvironment);
  const brandAssets = getBrandAssetPaths(appEnvironment);
  const releaseChannel = getReleaseChannel();
  const runtimeVersion = getRuntimeVersion(appEnvironment);
  const hasDevelopmentClient = usesDevelopmentClient(appEnvironment);
  const e2eTesting = isE2ETestingEnabled();
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
              NSAllowsLocalNetworking: allowsLocalNetworking(appEnvironment),
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

  if (!e2eTesting) {
    plugins.push('./plugins/with-widget-bundle-update');
    plugins.push('@bacons/apple-targets');
  }

  if (hasDevelopmentClient) {
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
    name: appEnvironmentConfig.displayName,
    slug: 'hakumi',
    version: '1.0.0',
    scheme: appEnvironmentConfig.scheme,
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
      appleTeamId: APPLE_TEAM_ID,
      icon: brandAssets.icon,
      bundleIdentifier: appEnvironmentConfig.bundleIdentifier,
      supportsTablet: true,
      entitlements: {
        'com.apple.developer.siri': true,
        'keychain-access-groups': [`$(AppIdentifierPrefix)${appEnvironmentConfig.bundleIdentifier}`],
      },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          'Omiro may use your location only when you choose media that includes location details, so it can preserve context for your notes.',
        NSMicrophoneUsageDescription:
          'Allow Omiro to access your microphone to record voice notes on your device.',
        NSSpeechRecognitionUsageDescription:
          'Allow Omiro to transcribe recorded voice notes into text on your device.',
      },
    },
    extra: {
      appEnvironment,
      appScheme: appEnvironmentConfig.scheme,
      e2eTesting,
      isDevClient: hasDevelopmentClient,
      ...(releaseChannel ? { releaseChannel } : {}),
      ...extraConfig,
      eas: {
        projectId: EXPO_PROJECT_ID,
      },
    },
    ...(runtimeVersion ? { runtimeVersion } : {}),
    updates: getUpdatesConfig(appEnvironment, releaseChannel),
  };
};

const ENVIRONMENT_ICON_NAMES = Object.freeze({
  development: 'icon.dev.png',
  production: 'icon.png',
} as const satisfies Record<AppEnvironment, string>);
