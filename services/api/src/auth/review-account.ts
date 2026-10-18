import type { ApiEnv } from '../env.schema';

type ReviewEnv = Pick<ApiEnv, 'APP_REVIEW_EMAIL' | 'APP_REVIEW_CODE'>;

// App Review cannot read an email, so one address signs in with a code held in the environment.
// Safe because: off unless both values are set; the code is long (the env schema rejects short
// ones), so guessing it is out of reach on top of better-auth's 3 attempts per code; it applies
// to sign-in only, for that exact address; it is never emailed or logged; and the address still
// has to be allowed (`credentials allow`) to get a key. Remove both values after review.
export function reviewSignInCode(
  inputEnv: ReviewEnv,
  input: { email: string; type: string },
): string | undefined {
  const reviewEmail = inputEnv.APP_REVIEW_EMAIL.trim().toLowerCase();
  const code = inputEnv.APP_REVIEW_CODE;
  if (!reviewEmail || !code) return undefined;
  if (input.type !== 'sign-in') return undefined;
  return input.email.trim().toLowerCase() === reviewEmail ? code : undefined;
}
