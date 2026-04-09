const LOCAL_ENV_VARIANTS = new Set(['dev'] as const);
const RELEASE_ENV_VARIANTS = new Set(['preview', 'production'] as const);
const REQUIRED_RELEASE_ENV_VARS = [
  'EXPO_PUBLIC_API_BASE_URL',
  'EXPO_PUBLIC_POSTHOG_API_KEY',
  'EXPO_PUBLIC_POSTHOG_HOST',
] as const;

type EnvVarName = (typeof REQUIRED_RELEASE_ENV_VARS)[number];

function canUseLocalEnvFile(variant: string): boolean {
  return LOCAL_ENV_VARIANTS.has(variant as (typeof LOCAL_ENV_VARIANTS extends Set<infer T> ? T : never));
}

function isReleaseVariant(variant: string): boolean {
  return RELEASE_ENV_VARIANTS.has(variant as (typeof RELEASE_ENV_VARIANTS extends Set<infer T> ? T : never));
}

function assertReleaseEnv(variant: string, env: Record<string, string | undefined>): void {
  if (!isReleaseVariant(variant)) {
    return;
  }

  for (const name of REQUIRED_RELEASE_ENV_VARS) {
    if (!env[name]) {
      throw new Error(`Missing release env var ${name} for ${variant}`);
    }
  }
}

export { assertReleaseEnv, canUseLocalEnvFile, isReleaseVariant };
