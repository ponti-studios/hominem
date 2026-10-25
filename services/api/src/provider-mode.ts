import type { ApiEnv } from './env.schema';

export type AiProvider = 'openrouter' | 'scripted';
export type EmailProvider = 'resend' | 'scripted';

const PROVIDERS = {
  email: 'resend',
  ai: 'openrouter',
} as const;

// Local toggle for canned AI replies (no model, no key, no cost). The dev server runs under
// `tsx watch`, so flipping this and saving restarts it with the new mode. Keep it `false` when
// committing: index.ts refuses to boot scripted providers in production.
export const USE_SCRIPTED_AI = false;

export function resolveAiProvider(): AiProvider {
  return USE_SCRIPTED_AI ? 'scripted' : 'openrouter';
}

export function resolveEmailProvider(env: Pick<ApiEnv, 'ENV' | 'NODE_ENV'>): EmailProvider {
  if (env.ENV === 'scripted') {
    return 'scripted';
  }

  return env.NODE_ENV !== 'production' ? 'scripted' : PROVIDERS.email;
}
