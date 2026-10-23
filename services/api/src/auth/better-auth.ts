import { createHash, randomInt } from 'node:crypto';

import { cimd } from '@better-auth/cimd';
import { fetchClientMetadataResource } from '@better-auth/cimd/node';
import { expo } from '@better-auth/expo';
import { kyselyAdapter } from '@better-auth/kysely-adapter';
import { mcp } from '@better-auth/mcp';
import { authDb } from '@hominem/db/core';
import { logger } from '@hominem/telemetry';
import type { BetterAuthOptions, BetterAuthPlugin } from 'better-auth';
import { betterAuth } from 'better-auth';
import { emailOTP, jwt, multiSession, openAPI } from 'better-auth/plugins';
import { oneTimeToken } from 'better-auth/plugins/one-time-token';

import { activatePendingInvitesForUser } from '../application/collections.service';
import { API_BRAND } from '../brand';
import { env } from '../env';
import type { ApiEnv } from '../env.schema';
import { MCP_SCOPES } from '../scopes';
import { reviewSignInCode } from './review-account';
import { getTrustedOrigins } from './trusted-origins';

function getAdvancedOptions(inputEnv: ApiEnv) {
  const cookieDomain = inputEnv.AUTH_COOKIE_DOMAIN.trim();
  const crossSubDomainEnabled = cookieDomain.length > 0;
  const useSecureCookies =
    inputEnv.NODE_ENV === 'production' || new URL(inputEnv.API_URL).protocol === 'https:';

  return {
    database: {
      generateId: 'uuid' as const,
    },
    useSecureCookies,
    // Better Auth's own limiter keys on this header. x-forwarded-for (the default) is client-controlled.
    ipAddress: {
      ipAddressHeaders: inputEnv.ORIGIN_SECRET ? ['cf-connecting-ip'] : ['fly-client-ip'],
    },
    ...(crossSubDomainEnabled
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: cookieDomain,
          },
        }
      : {}),
    defaultCookieAttributes: {
      sameSite: 'lax' as const,
      httpOnly: true,
      secure: useSecureCookies,
    },
  };
}

export type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Inline images referenced from the html as `cid:<contentId>`. */
  attachments?: { filename: string; content: Buffer; contentId: string }[];
};

type VerificationOtpType = 'sign-in' | 'email-verification' | 'forget-password' | string;

const verificationOtpSubjectByType: Record<VerificationOtpType, string> = {
  'sign-in': 'Your sign-in code',
  'email-verification': 'Verify your email',
  'forget-password': 'Reset your password',
};

const OTP_LENGTH = 6;

// Lets us tie log lines to the same recipient without logging a raw email.
// The logger auto-redacts any key with "email" in the name (case insensitive),
// so these field names have to dodge that substring too - not just avoid
// holding the raw address - otherwise they'd get redacted into mush anyway.
function emailLogContext(email: string): { recipientHash: string; recipientDomain: string } {
  return {
    recipientHash: createHash('sha256').update(email).digest('hex').slice(0, 12),
    recipientDomain: email.split('@')[1] ?? 'unknown',
  };
}

export async function sendEmail(
  inputEnv: ApiEnv,
  { to, subject, text, html, attachments }: SendEmailParams,
): Promise<void> {
  const from = inputEnv.RESEND_FROM_NAME
    ? `${inputEnv.RESEND_FROM_NAME} <${inputEnv.RESEND_FROM_EMAIL}>`
    : inputEnv.RESEND_FROM_EMAIL;

  if (!from) {
    throw new Error('RESEND_FROM_EMAIL is not set');
  }

  const { Resend } = await import('resend');
  const resend = new Resend(inputEnv.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    to,
    from,
    subject,
    text,
    ...(html ? { html } : {}),
    ...(attachments ? { attachments } : {}),
  });

  if (error) {
    logger.error('[auth:email] resend rejected send', {
      ...emailLogContext(to),
      subject,
      from,
      errorName: error.name,
      errorMessage: error.message,
    });
    throw new Error(`Resend failed to send email: ${error.message}`);
  }

  logger.info('[auth:email] resend accepted send', {
    ...emailLogContext(to),
    subject,
    resendId: data?.id ?? null,
  });
}

function getVerificationOtpSubject(type: VerificationOtpType) {
  return verificationOtpSubjectByType[type] ?? 'Your verification code';
}

// Mirrors the hosted auth pages (routes/login/app/styles.css): warm paper
// background, white card, forest-green accent, Fraunces-style serif headings.
// Email clients need inline styles + tables, so the palette is repeated here
// with a dark-mode override for clients that honor prefers-color-scheme.
function buildVerificationOtpEmail(input: {
  to: string;
  otp: string;
  type: VerificationOtpType;
  expiresInSeconds: number;
}): SendEmailParams {
  const minutes = Math.max(1, Math.round(input.expiresInSeconds / 60));
  const expiry = `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const heading =
    input.type === 'sign-in' ? 'Your sign-in code' : getVerificationOtpSubject(input.type);
  const serif = "Fraunces, Georgia, 'Times New Roman', serif";
  const sans = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  return {
    to: input.to,
    subject: getVerificationOtpSubject(input.type),
    // Test mailbox helpers parse "verification code is: NNNNNN" out of this line.
    text: `Your verification code is: ${input.otp}\n\nThis code expires in ${expiry}. If you didn't request it, you can safely ignore this email.\n\n${API_BRAND.appName}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    @media (prefers-color-scheme: dark) {
      .bg { background: #141310 !important; }
      .card { background: #1c1a16 !important; border-color: #4a453b !important; }
      .text { color: #edeae2 !important; }
      .muted { color: #a9a396 !important; }
      .accent { color: #8fc1ae !important; }
      .code { background: #141310 !important; border-color: #4a453b !important; color: #8fc1ae !important; }
    }
  </style>
</head>
<body class="bg" style="margin: 0; padding: 0; background: #f6f3ec;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background: #f6f3ec;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px;">
          <tr>
            <td class="accent" style="padding: 0 4px 20px; font-family: ${serif}; font-size: 22px; font-weight: 600; letter-spacing: -0.01em; color: #2f5d50;">
              ${API_BRAND.appName}
            </td>
          </tr>
          <tr>
            <td class="card" style="padding: 32px 28px; background: #ffffff; border: 1px solid #b9b2a3; border-radius: 16px;">
              <h1 class="text" style="margin: 0 0 8px; font-family: ${serif}; font-size: 28px; line-height: 1.2; font-weight: 600; letter-spacing: -0.01em; color: #1b1a17;">${heading}</h1>
              <p class="muted" style="margin: 0 0 24px; font-family: ${sans}; font-size: 16px; line-height: 1.5; color: #5e594f;">Type this code where you started signing in.</p>
              <div class="code" style="padding: 18px 12px; text-align: center; font-family: ${serif}; font-size: 36px; font-weight: 600; letter-spacing: 10px; text-indent: 10px; color: #2f5d50; background: #f6f3ec; border: 1px solid #b9b2a3; border-radius: 12px;">${input.otp}</div>
              <p class="muted" style="margin: 24px 0 0; font-family: ${sans}; font-size: 14px; line-height: 1.5; color: #5e594f;">This code expires in ${expiry}. If you didn't ask for it, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

function getAuthPlugins(inputEnv: ApiEnv) {
  const plugins: BetterAuthPlugin[] = [
    expo(),
    emailOTP({
      expiresIn: inputEnv.AUTH_EMAIL_OTP_EXPIRES_SECONDS,
      resendStrategy: 'reuse',
      generateOTP: ({ email, type }) =>
        reviewSignInCode(inputEnv, { email, type }) ??
        randomInt(0, 10 ** OTP_LENGTH)
          .toString()
          .padStart(OTP_LENGTH, '0'),
      sendVerificationOTP: async ({ email, otp, type }) => {
        // The review code is fixed, so it must never be put in an email.
        if (reviewSignInCode(inputEnv, { email, type }) !== undefined) return;
        try {
          await sendEmail(
            inputEnv,
            buildVerificationOtpEmail({
              to: email,
              otp,
              type,
              expiresInSeconds: inputEnv.AUTH_EMAIL_OTP_EXPIRES_SECONDS,
            }),
          );
        } catch (error) {
          logger.error('[auth:email-otp] failed to deliver verification email', {
            ...emailLogContext(email),
            type,
            error,
          });
          throw error;
        }
      },
    }),
    jwt(),
    // A one-minute link that signs the Thames app's web view in to the account page.
    oneTimeToken({ expiresIn: 1 }),
    mcp({
      loginPage: new URL('/login', inputEnv.API_URL).toString(),
      consentPage: new URL('/consent', inputEnv.API_URL).toString(),
      resource: new URL('/api/mcp', inputEnv.API_URL).toString(),
      scopes: ['openid', 'profile', 'email', 'offline_access', ...MCP_SCOPES],
      resources: [new URL('/api/mcp', inputEnv.API_URL).toString()],
      clientRegistrationDefaultResources: [new URL('/api/mcp', inputEnv.API_URL).toString()],
      clientRegistrationAllowedResources: [new URL('/api/mcp', inputEnv.API_URL).toString()],
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
    }),
    cimd({
      fetchClientMetadataResource,
      metadataProfile: 'mcp-2026-07-28',
    }),
    multiSession({ maximumSessions: 8 }),
    // Reference page lists every endpoint; fine locally, not worth exposing in production.
    ...(inputEnv.NODE_ENV === 'production'
      ? []
      : [openAPI({ path: '/reference', theme: 'deepSpace' })]),
  ];

  return plugins;
}

// Email OTP is the only auth surface we actually use. Password auth, device
// authorization, JWT/JWKS, and one-time tokens are turned off on purpose
// until something actually needs them.
export function createBetterAuthServer(inputEnv: ApiEnv) {
  const betterAuthOptions: BetterAuthOptions = {
    secret: inputEnv.BETTER_AUTH_SECRET,
    baseURL: inputEnv.API_URL,
    trustedOrigins: getTrustedOrigins(inputEnv),
    advanced: getAdvancedOptions(inputEnv),
    emailAndPassword: {
      enabled: false,
    },
    session: {
      // Rolling: a session lasts 90 days from the last day it was used (renewed at most once a
      // day), so someone who opens an app now and then is never asked to sign in again. The
      // server default was 7 days. A device that goes unused for 90 days signs in again.
      expiresIn: 60 * 60 * 24 * 90,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 60 * 24, // 24 hours
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
    rateLimit: {
      storage: 'database',
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await activatePendingInvitesForUser(user.id, user.email);
          },
        },
      },
    },
    plugins: getAuthPlugins(inputEnv),
  };

  return betterAuth({
    ...betterAuthOptions,
    database: kyselyAdapter(authDb),
  });
}

export const betterAuthServer = createBetterAuthServer(env);
