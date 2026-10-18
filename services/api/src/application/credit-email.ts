import { db } from '@hominem/db/core';

import { env } from '../env';
import { signLinkToken } from './credit';

/** The top-up page's address for this person: a signed link that stands in for signing in. */
export function topUpLink(userId: string, now: Date = new Date()): string {
  const token = signLinkToken(env.BETTER_AUTH_SECRET, userId, now);
  return `${env.API_URL.replace(/\/$/, '')}/credit?t=${token}`;
}

/** The "you're running low" email: one line and the link. It names no price. */
export async function sendLowCreditEmail(userId: string): Promise<void> {
  const user = await db
    .selectFrom('user')
    .select('email')
    .where('id', '=', userId)
    .executeTakeFirstOrThrow();
  const link = topUpLink(userId);
  // Loaded here, not at the top: importing the auth server builds it, which a route test cannot do.
  const { sendEmail } = await import('../auth/better-auth');
  await sendEmail(env, {
    to: user.email,
    subject: 'Your Thames credit is running low',
    text: `Your Thames credit is running low.\n\nAdd more here: ${link}\n\nThe link works for 7 days.`,
    html: `<p>Your Thames credit is running low.</p><p><a href="${link}">Add more credit</a></p><p>The link works for 7 days.</p>`,
  });
}
