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

const poundsText = (pence: number) => `£${(pence / 100).toFixed(2)}`;

/**
 * The confirmation of a top-up, kept by the person. It repeats what they agreed to before paying:
 * the credit was added as soon as they paid, and the 14-day right to cancel ended when it was
 * (Consumer Contracts Regulations 2013), so the consent is confirmed on a durable medium.
 */
export async function sendTopUpConfirmationEmail(input: {
  userId: string;
  amountPence: number;
  creditPence: number;
}): Promise<void> {
  const user = await db
    .selectFrom('user')
    .select('email')
    .where('id', '=', input.userId)
    .executeTakeFirstOrThrow();
  const paid = poundsText(input.amountPence);
  const credit = poundsText(input.creditPence);
  const lines = [
    `You paid ${paid} and ${credit} of Thames credit has been added to your account.`,
    'Before you paid, you asked for your credit to be added as soon as you paid, and you agreed that once it was added you would lose your 14-day right to cancel.',
    'Credit works only in Thames and does not expire. It is not refundable except where the law requires. Stripe emails your payment receipt separately.',
  ];
  const { sendEmail } = await import('../auth/better-auth');
  await sendEmail(env, {
    to: user.email,
    subject: `Your Thames credit: ${credit} added`,
    text: lines.join('\n\n'),
    html: lines.map((line) => `<p>${line}</p>`).join(''),
  });
}

/** Sent when a payment is not from a UK card and address: it says nothing was charged. */
export async function sendTopUpNotChargedEmail(userId: string): Promise<void> {
  const user = await db
    .selectFrom('user')
    .select('email')
    .where('id', '=', userId)
    .executeTakeFirstOrThrow();
  const lines = [
    'Thames credit is for UK cards and UK billing addresses only for now, so we could not add credit for your payment.',
    'You have not been charged. If your bank shows a pending amount, it is released by your bank, usually within a few days.',
  ];
  const { sendEmail } = await import('../auth/better-auth');
  await sendEmail(env, {
    to: user.email,
    subject: 'Your Thames payment was not taken',
    text: lines.join('\n\n'),
    html: lines.map((line) => `<p>${line}</p>`).join(''),
  });
}
