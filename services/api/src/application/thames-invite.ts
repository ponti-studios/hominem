import { createHash } from 'node:crypto';

export type InviteDeps = {
  /** The TestFlight public link. Without it nothing is sent. */
  link: string | undefined;
  isAllowed(email: string): Promise<boolean>;
  /** True while the key is under its limit; counts this try. */
  withinLimit(key: string, max: number, windowSec: number): Promise<boolean>;
  qrPng(link: string): Promise<Buffer>;
  send(message: {
    to: string;
    subject: string;
    text: string;
    html: string;
    attachments: { filename: string; content: Buffer; contentId: string }[];
  }): Promise<void>;
};

export type InviteOutcome = 'sent' | 'not_listed' | 'rate_limited' | 'unavailable';

const PER_EMAIL = { max: 3, windowSec: 3600 };
const PER_NETWORK = { max: 20, windowSec: 3600 };

function hashed(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

/**
 * Emails the TestFlight link, as a QR code, to an allowed address. The route answers the same for
 * every outcome, so the page never tells a stranger whether a domain is on the list.
 */
export async function inviteToThames(
  deps: InviteDeps,
  input: { email: string; network: string },
): Promise<InviteOutcome> {
  const email = input.email.trim().toLowerCase();
  if (!deps.link) return 'unavailable';
  if (
    !(await deps.withinLimit(
      `network:${hashed(input.network)}`,
      PER_NETWORK.max,
      PER_NETWORK.windowSec,
    ))
  ) {
    return 'rate_limited';
  }
  if (!(await deps.withinLimit(`email:${hashed(email)}`, PER_EMAIL.max, PER_EMAIL.windowSec))) {
    return 'rate_limited';
  }
  if (!(await deps.isAllowed(email))) return 'not_listed';

  const png = await deps.qrPng(deps.link);
  await deps.send({
    to: email,
    subject: 'Your Thames invite',
    text: `Thames is ready for you. On your iPhone, scan the code in this email, or open ${deps.link}. Install TestFlight if it asks, then Thames. Sign in with this email address.`,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:20px;line-height:1.6">
<h1 style="margin:0 0 12px;font-size:24px">Thames is ready for you</h1>
<p>On your iPhone, point the camera at this code.</p>
<p><img src="cid:thames-invite" alt="QR code for the Thames TestFlight link" width="220" height="220" style="display:block"></p>
<p>Or <a href="${deps.link}">open the link</a>. Install TestFlight if it asks, then Thames. Sign in with this email address.</p>
</div>`,
    attachments: [{ filename: 'thames-invite.png', content: png, contentId: 'thames-invite' }],
  });
  return 'sent';
}
