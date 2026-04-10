jest.mock('expo-secure-store', () => ({
  deleteItemAsync: async () => undefined,
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        appScheme: 'hakumi-e2e',
        appVariant: 'e2e',
      },
    },
  },
}));

jest.mock('expo-device', () => ({
  isDevice: false,
}));

jest.mock('@better-auth/expo/client', () => ({
  expoClient: (config: unknown) => ({
    config,
    name: 'expoClient',
  }),
}));

jest.mock('@better-auth/passkey/client', () => ({
  passkeyClient: () => ({
    name: 'passkeyClient',
  }),
}));

jest.mock('better-auth/client/plugins', () => ({
  emailOTPClient: () => ({
    name: 'emailOTPClient',
  }),
}));

jest.mock('better-auth/react', () => ({
  createAuthClient: (config: unknown) => ({
    config,
    signIn: jest.fn(),
  }),
}));

function loadConstants() {
  const nodeRequire = require as typeof require & {
    resolve(path: string): string;
    cache: Record<string, unknown>;
  };

  const modulePath = nodeRequire.resolve('~/constants');
  delete nodeRequire.cache[modulePath];
  return nodeRequire('~/constants') as typeof import('~/constants');
}

function loadAuthClient() {
  const nodeRequire = require as typeof require & {
    resolve(path: string): string;
    cache: Record<string, unknown>;
  };

  const authClientPath = nodeRequire.resolve('./auth-client');
  const constantsPath = nodeRequire.resolve('~/constants');
  delete nodeRequire.cache[authClientPath];
  delete nodeRequire.cache[constantsPath];
  return nodeRequire('./auth-client') as typeof import('./auth-client');
}

describe('auth client', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://test-api.example.com';
    process.env.APP_VARIANT = 'e2e';
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    delete process.env.APP_VARIANT;
  });

  it('creates an auth client with the Expo plugin', () => {
    const { authClient } = loadAuthClient();

    expect(authClient).toBeDefined();
    expect(typeof authClient.signIn).toBe('function');
  });

  it('uses the active app scheme for auth redirects', () => {
    const { APP_SCHEME } = loadConstants();

    expect(APP_SCHEME).toBe('hakumi-e2e');
  });

  it('uses the configured API base URL', () => {
    const { API_BASE_URL } = loadConstants();

    expect(API_BASE_URL).toBe('https://test-api.example.com');
  });
});
