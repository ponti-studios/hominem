import { BRAND } from '@hominem/env/brand';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string;
  appEnvironment?: string;
  appScheme?: string;
};

const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoClient?.hostUri;
const localHost = hostUri ? hostUri.split(':').shift() : null;

function toDeviceReachableApiBaseUrl(baseUrl: string, host: string | null) {
  if (!baseUrl || !host) {
    return baseUrl;
  }

  try {
    const parsed = new URL(baseUrl);
    const isLocalHost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1';
    if (!isLocalHost) {
      return baseUrl;
    }

    parsed.hostname = host;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return baseUrl;
  }
}

const configuredApiBaseUrlRaw = extra.apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL || '';
const configuredApiBaseUrl = toDeviceReachableApiBaseUrl(
  configuredApiBaseUrlRaw,
  localHost ?? null,
);
const fallbackApiBaseUrl = localHost ? `http://${localHost}:4040` : 'http://localhost:4040';
const appEnvironment = extra.appEnvironment ?? process.env.APP_ENV ?? 'development';
const releaseChannel = appEnvironment === 'production' ? appEnvironment : null;
export const E2E_TESTING = appEnvironment === 'e2e';
function isReleaseAppEnvironment(environment: string) {
  return environment === 'production';
}

const isReleaseRuntime = isReleaseAppEnvironment(appEnvironment);

if (!configuredApiBaseUrl && isReleaseRuntime) {
  throw new Error(
    `Missing API base URL. Set EXPO_PUBLIC_API_BASE_URL for the ${releaseChannel ?? 'production'} runtime.`,
  );
}

export const API_BASE_URL = configuredApiBaseUrl || fallbackApiBaseUrl;
export const APP_ENV = appEnvironment;
export const APP_SCHEME = extra.appScheme || 'hakumi';
export const APP_NAME = BRAND.appName;
export const RELEASE_CHANNEL = releaseChannel;
