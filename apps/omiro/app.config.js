const { z } = require('zod');
const withPrivacyManifest = require('./plugins/withPrivacyManifest');
const withSceneLifecycle = require('./plugins/withSceneLifecycle');

// Keeping this schema local (instead of importing env.ts's) because Expo
// evaluates this config during native builds, before that module is usable.
const appEnvironmentSchema = z.enum(['development', 'e2e', 'production', 'screenshots']);

const EXPO_OWNER = 'pontistudios';
const EXPO_PROJECT_ID = '4dfac82b-644f-4ff3-be42-e8f941287aa1';
const APPLE_TEAM_ID = '3QHJ2KN8AL';

// development and e2e share the dev app identity/icon; production and
// screenshots share the real one. Nothing else varies by environment.
const DEV_APP_CONFIG = Object.freeze({
  bundleIdentifier: 'com.pontistudios.hakumi.dev',
  displayName: 'Omiro Dev',
  scheme: 'hakumi-dev',
  icon: './assets/icon.dev.png',
});

const PRODUCTION_APP_CONFIG = Object.freeze({
  bundleIdentifier: 'com.pontistudios.hakumi',
  displayName: 'Omiro',
  scheme: 'hakumi',
  icon: './assets/icon.png',
});

const SPLASH_IMAGE = './assets/logo.splash-screen.png';

// EAS sets EAS_BUILD_PROFILE on the builder, and unlike APP_ENV it can't get
// shadowed by a stray local .env file (we got bit once by a "production"
// build picking up .env.development.local and shipping the dev identity to
// the App Store). So whenever a build profile is actually present,
// EAS_BUILD_PROFILE wins and a conflicting APP_ENV throws instead of us just
// guessing.
//
// EAS_BUILD is also set to "true" on submit/update job runners (e.g. the
// `testflight` workflow job type), which have no build profile at all — only
// EAS_BUILD_PROFILE tells us whether we're actually in a build, so we check
// that directly instead of gating on EAS_BUILD.
function getAppEnvironment() {
  const appEnv = process.env.APP_ENV;
  const profile = process.env.EAS_BUILD_PROFILE;

  if (profile) {
    const resolvedProfile = appEnvironmentSchema.parse(profile);
    if (appEnv && appEnv !== resolvedProfile) {
      throw new Error(
        `APP_ENV ("${appEnv}") conflicts with EAS_BUILD_PROFILE ("${resolvedProfile}"). Refusing to guess which app identity to build.`,
      );
    }
    return resolvedProfile;
  }

  if (process.env.EAS_BUILD === 'true' && !appEnv) {
    throw new Error('EAS_BUILD is set but neither EAS_BUILD_PROFILE nor APP_ENV is set.');
  }

  if (appEnv) {
    return appEnvironmentSchema.parse(appEnv);
  }

  if (process.env.CI === 'true') {
    throw new Error('APP_ENV must be set explicitly when running in CI.');
  }

  return 'development';
}

function createConfig({ config }) {
  const appEnvironment = getAppEnvironment();
  const isDevIdentity = appEnvironment === 'development' || appEnvironment === 'e2e';
  const isProduction = appEnvironment === 'production';
  const hasDevelopmentClient = appEnvironment === 'development';
  const appEnvironmentConfig = isDevIdentity ? DEV_APP_CONFIG : PRODUCTION_APP_CONFIG;
  const plugins = [
    'expo-router',
    [
      'expo-font',
      {
        fonts: [
          './assets/fonts/Geist-Regular.otf',
          './assets/fonts/Geist-SemiBold.otf',
          './assets/fonts/Geist-Bold.otf',
          './assets/fonts/GeistMono-Regular.otf',
          './assets/fonts/GeistPixel-Circle.otf',
          './assets/fonts/GeistPixel-Grid.otf',
          './assets/fonts/GeistPixel-Line.otf',
          './assets/fonts/GeistPixel-Square.otf',
          './assets/fonts/GeistPixel-Triangle.otf',
        ],
      },
    ],
    '@sentry/react-native',
    withPrivacyManifest,
    withSceneLifecycle,
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '26.5',
          infoPlist: {
            NSAppTransportSecurity: {
              NSAllowsArbitraryLoads: false,
              NSAllowsLocalNetworking: isDevIdentity,
            },
          },
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        image: SPLASH_IMAGE,
        enableFullScreenImage_legacy: true,
        resizeMode: 'cover',
      },
    ],
    ['expo-secure-store'],
    'expo-asset',
    'expo-audio',
    'expo-image',
    'expo-localization',
    'expo-sharing',
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

  if (hasDevelopmentClient) {
    plugins.splice(1, 0, [
      'expo-dev-client',
      {
        launchMode: 'most-recent',
        skipOnboarding: true,
        showMenuAtLaunch: false,
      },
    ]);
  }

  return {
    ...config,
    name: appEnvironmentConfig.displayName,
    slug: 'hakumi',
    version: '1.0.1',
    scheme: appEnvironmentConfig.scheme,
    owner: EXPO_OWNER,
    platforms: ['ios'],
    orientation: 'portrait',
    icon: appEnvironmentConfig.icon,
    userInterfaceStyle: 'automatic',
    backgroundColor: '#111113',
    assetBundlePatterns: ['assets/**/*', 'api/**/*', 'app/**/*', 'constants/**/*', 'hooks/**/*', 'navigation/**/*', 'services/**/*'],
    plugins,
    experiments: {
      tsconfigPaths: true,
    },
    // Only production ships to the App Store, so only it gets a fingerprint
    // runtimeVersion + EAS Update URL. The channel itself comes from
    // eas.json's build profile, not here, so the two can't drift apart.
    ...(isProduction ? { runtimeVersion: { policy: 'fingerprint' } } : {}),
    updates: isProduction
      ? { url: `https://u.expo.dev/${EXPO_PROJECT_ID}` }
      : { enabled: false, checkAutomatically: 'NEVER', fallbackToCacheTimeout: 0 },
    ios: {
      appleTeamId: APPLE_TEAM_ID,
      icon: appEnvironmentConfig.icon,
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
        NSCalendarsFullAccessUsageDescription:
          'Allow Omiro to read your calendar so on-device chat can answer questions about your schedule.',
      },
    },
    extra: {
      appEnvironment,
      appScheme: appEnvironmentConfig.scheme,
      isDevClient: hasDevelopmentClient,
      eas: {
        projectId: EXPO_PROJECT_ID,
      },
    },
  };
}

module.exports = createConfig;
module.exports.getAppEnvironment = getAppEnvironment;
