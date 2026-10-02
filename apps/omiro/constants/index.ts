import { BRAND } from '@hominem/env/brand';
import Constants from 'expo-constants';

import { env, parseAppEnvironment } from '~/env';

const rawExtra: Record<string, unknown> = Constants.expoConfig?.extra ?? {};
const extra = {
  appEnvironment: typeof rawExtra.appEnvironment === 'string' ? rawExtra.appEnvironment : undefined,
  appScheme: typeof rawExtra.appScheme === 'string' ? rawExtra.appScheme : undefined,
};

const appEnvironment = parseAppEnvironment(extra.appEnvironment ?? process.env.APP_ENV);
const releaseChannel = appEnvironment === 'production' ? appEnvironment : null;

export const E2E_TESTING = appEnvironment === 'e2e';

export const API_BASE_URL = env.EXPO_PUBLIC_API_BASE_URL;
export const APP_ENV = appEnvironment;
export const APP_SCHEME = extra.appScheme || 'hakumi';
export const APP_NAME = BRAND.appName;
export const RELEASE_CHANNEL = releaseChannel;
