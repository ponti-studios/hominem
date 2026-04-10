const EXPO_OWNER = 'pontistudios';
const EXPO_PROJECT_ID = '4dfac82b-644f-4ff3-be42-e8f941287aa1';
const EXPO_PROJECT_SLUG = 'hakumi';

const getEnvValue = (value: string | undefined, fallback: string): string => value ?? fallback;

function getExpoExtraConfig(
  env: Record<string, string | undefined>,
): {
  apiBaseUrl: string;
  mobilePasskeyEnabled: string;
} {
  return {
    apiBaseUrl: getEnvValue(env.EXPO_PUBLIC_API_BASE_URL, ''),
    mobilePasskeyEnabled: getEnvValue(env.EXPO_PUBLIC_MOBILE_PASSKEY_ENABLED, 'false'),
  };
}

export { EXPO_OWNER, EXPO_PROJECT_ID, EXPO_PROJECT_SLUG, getExpoExtraConfig };
