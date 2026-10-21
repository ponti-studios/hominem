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
  | 'NEWSBOY_URL'
  | 'ENV'
  | 'NODE_ENV'
  | 'MAESTRO_API_ORIGIN'
>;

export function getTrustedOrigins(inputEnv: TrustedOriginEnv = env) {
  const origins = new Set([
    inputEnv.API_URL,
    inputEnv.CAREER_URL,
    inputEnv.FINANCE_URL,
    inputEnv.WEB_URL,
    inputEnv.LABS_URL,
    ...(inputEnv.LABS_APEX_URL ? [inputEnv.LABS_APEX_URL] : []),
    inputEnv.NEWSBOY_URL,
    ...(inputEnv.ENV === 'scripted' &&
    inputEnv.NODE_ENV !== 'production' &&
    inputEnv.MAESTRO_API_ORIGIN
      ? [inputEnv.MAESTRO_API_ORIGIN]
      : []),
    'hakumi://',
    'hakumi-dev://',
    'hakumi-e2e://',
    'hakumi-preview://',
    'exp://',
  ]);
  return [...origins];
}
