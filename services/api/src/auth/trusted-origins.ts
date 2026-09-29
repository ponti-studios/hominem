import { env } from '../env';
import type { ApiEnv } from '../env.schema';

type TrustedOriginEnv = Pick<
  ApiEnv,
  | 'API_URL'
  | 'CAREER_URL'
  | 'FINANCE_URL'
  | 'WEB_URL'
  | 'LABS_URL'
  | 'LABS_APEX_URL'
  | 'WHAT_URL'
  | 'NEWSBOY_URL'
>;

export function getTrustedOrigins(inputEnv: TrustedOriginEnv = env) {
  const origins = new Set([
    inputEnv.API_URL,
    inputEnv.CAREER_URL,
    inputEnv.FINANCE_URL,
    inputEnv.WEB_URL,
    inputEnv.LABS_URL,
    ...(inputEnv.LABS_APEX_URL ? [inputEnv.LABS_APEX_URL] : []),
    inputEnv.WHAT_URL,
    inputEnv.NEWSBOY_URL,
    'hakumi://',
    'hakumi-dev://',
    'hakumi-e2e://',
    'hakumi-preview://',
    'exp://',
  ]);
  return [...origins];
}
