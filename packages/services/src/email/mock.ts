import { isObject } from '@hominem/utils';
import { appendScriptedMailboxRecord } from '@hominem/utils/email';

// Scripted Resend replacement for ENV=scripted: captures the OTP from a send
// instead of delivering it, and optionally mirrors it to a local mailbox
// file so out-of-process consumers (Playwright, Maestro) can read it. Paired
// with the real `resend` module so both live at one import site
// (`@hominem/services/email`).

type ScriptedResponse = {
  status: number;
  headers: Record<string, string>;
  frames: Array<{ data: string; delayMsBefore?: number }>;
};

type ScriptedEmail = {
  to: string;
  subject: string;
  text: string;
  otp: string | null;
  capturedAt: Date;
};

const capturedEmails = new Map<string, ScriptedEmail>();
let mailboxFile: string | null = null;

function extractOtp(text: string): string | null {
  return text.match(/verification code is: (\d{6})/i)?.[1] ?? null;
}

function isResendEmailBody(
  value: unknown,
): value is { to: string | string[]; subject: string; text: string } {
  if (!isObject(value)) return false;
  const to = Reflect.get(value, 'to');
  return (
    (typeof to === 'string' ||
      (Array.isArray(to) && to.every((item) => typeof item === 'string'))) &&
    typeof Reflect.get(value, 'subject') === 'string' &&
    typeof Reflect.get(value, 'text') === 'string'
  );
}

async function responder(rawBody: string): Promise<ScriptedResponse> {
  const body: unknown = rawBody ? JSON.parse(rawBody) : null;
  if (!isResendEmailBody(body)) {
    return {
      status: 400,
      headers: { 'content-type': 'application/json' },
      frames: [{ data: JSON.stringify({ error: 'Invalid scripted email body' }) }],
    };
  }
  const to = Array.isArray(body.to) ? body.to[0] : body.to;
  if (to) {
    const otp = extractOtp(body.text ?? '');
    capturedEmails.set(to, {
      to,
      subject: body.subject,
      text: body.text,
      otp,
      capturedAt: new Date(),
    });
    // Defense in depth behind the API's own refusal to run scripted+production
    // at boot: the mailbox only ever exists on non-production hosts.
    if (mailboxFile && process.env.NODE_ENV !== 'production' && otp) {
      appendScriptedMailboxRecord(mailboxFile, { to, otp, subject: body.subject });
    }
  }
  return {
    status: 200,
    headers: { 'content-type': 'application/json' },
    frames: [{ data: JSON.stringify({ id: `scripted-email-${capturedEmails.size}` }) }],
  };
}

export function getScriptedEmail(to: string): ScriptedEmail | null {
  return capturedEmails.get(to) ?? null;
}

// Clears captured state and (re)points the mailbox file. Callers install
// this fresh per test run/lifecycle, so state never leaks across installs.
export function resetResendMock(nextMailboxFile: string | null = null): void {
  capturedEmails.clear();
  mailboxFile = nextMailboxFile;
}

// Route descriptor consumed by the scripted-provider dispatcher (see
// services/api/src/testkit/scripted-providers.ts), which owns the actual
// undici interception and combines this with other providers' routes.
export const route = {
  origin: 'https://api.resend.com',
  path: '/emails',
  method: 'POST',
  responder,
};
