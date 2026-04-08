const AUTH_API_BASE_URL = 'http://localhost:4040';

export const AUTH_E2E_SECRET = 'otp-secret';
export const AUTH_SEND_OTP_URL = `${AUTH_API_BASE_URL}/api/auth/email-otp/send-verification-otp`;
export const AUTH_SIGN_IN_URL = `${AUTH_API_BASE_URL}/api/auth/sign-in/email-otp`;
export const AUTH_TEST_OTP_URL = `${AUTH_API_BASE_URL}/api/auth/test/otp/latest`;

let authTestSequence = 0;

function getWorkerId() {
  return process.env.TEST_WORKER_INDEX ?? process.env.PLAYWRIGHT_WORKER_INDEX ?? '0';
}

function normalizePrefix(prefix: string) {
  const normalized = prefix
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.slice(0, 48) || 'web-auth';
}

export function createAuthTestEmail(prefix: string) {
  authTestSequence += 1;
  return `${normalizePrefix(prefix)}-${getWorkerId()}-${authTestSequence}@hominem.test`;
}
