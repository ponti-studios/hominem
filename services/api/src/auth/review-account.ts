import type { ApiEnv } from '../env.schema';

type ReviewEnv = Pick<ApiEnv, 'APP_REVIEW_EMAIL' | 'APP_REVIEW_CODE' | 'APP_REVIEW_UNTIL'>;

// App Review cannot read an email, so one address signs in with a code held in the environment.
// The apps only accept six digits, so the code cannot be long. What keeps it safe instead:
// it is off unless the address, code and an expiry are all set; it stops working at the expiry;
// it applies to sign-in only, for that exact address; it is random, never emailed or logged;
// better-auth voids a code after 3 wrong tries and rate-limits requests; and the address still
// has to be allowed (`credentials allow`) to get a key, which carries the per-person cap.
// Remove the variables after review.
export function reviewSignInCode(
  inputEnv: ReviewEnv,
  input: { email: string; type: string },
  now: Date = new Date(),
): string | undefined {
  const reviewEmail = inputEnv.APP_REVIEW_EMAIL.trim().toLowerCase();
  const code = inputEnv.APP_REVIEW_CODE;
  const until = Date.parse(inputEnv.APP_REVIEW_UNTIL);
  if (!reviewEmail || !code || Number.isNaN(until)) return undefined;
  if (now.getTime() >= until) return undefined;
  if (input.type !== 'sign-in') return undefined;
  return input.email.trim().toLowerCase() === reviewEmail ? code : undefined;
}
