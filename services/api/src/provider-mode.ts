import type { ApiEnv } from './env.schema';

export type AiProvider = 'openrouter' | 'scripted';
export type EmailProvider = 'resend' | 'scripted';

const PROVIDERS = {
  email: 'resend',
  ai: 'openrouter',
} as const;

export function resolveAiProvider(env: Pick<ApiEnv, 'USE_SCRIPTED_AI'>): AiProvider {
  return env.USE_SCRIPTED_AI ? 'scripted' : PROVIDERS.ai;
}

export function resolveEmailProvider(env: Pick<ApiEnv, 'ENV' | 'NODE_ENV'>): EmailProvider {
  if (env.ENV === 'scripted') {
    return 'scripted';
  }

  return env.NODE_ENV !== 'production' ? 'scripted' : PROVIDERS.email;
}
