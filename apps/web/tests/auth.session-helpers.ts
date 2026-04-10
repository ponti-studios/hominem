import type { APIRequestContext, APIResponse, BrowserContext } from '@playwright/test';

import { AUTH_E2E_SECRET, AUTH_SEND_OTP_URL, AUTH_SIGN_IN_URL, AUTH_TEST_OTP_URL } from './auth.shared';
import { pollForOtp } from './auth.flow-helpers';

interface OtpResponse {
  otp: string;
}

export type AuthStorageState = Awaited<ReturnType<APIRequestContext['storageState']>>;

async function readResponseBody(response: APIResponse) {
  try {
    return await response.text();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export async function requestSignInOtp(request: APIRequestContext, email: string) {
  const response = await request.post(AUTH_SEND_OTP_URL, {
    data: {
      email,
      type: 'sign-in',
    },
  });

  if (response.status() === 200) {
    return;
  }

  const body = await readResponseBody(response);
  throw new Error(`OTP request failed for ${email} (${response.status()}): ${body}`);
}

export async function fetchLatestSignInOtp(request: APIRequestContext, email: string) {
  return pollForOtp(async () => {
    const response = await request.get(AUTH_TEST_OTP_URL, {
      headers: {
        'x-e2e-auth-secret': AUTH_E2E_SECRET,
      },
      params: {
        email,
        type: 'sign-in',
      },
    });

    if (response.status() === 200) {
      const payload = (await response.json()) as OtpResponse;
      return { status: response.status(), body: '', otp: payload.otp };
    }

    return {
      status: response.status(),
      body: await readResponseBody(response),
    };
  });
}

export async function signInWithEmailOtp(request: APIRequestContext, email: string) {
  await requestSignInOtp(request, email);
  const otp = await fetchLatestSignInOtp(request, email);

  const response = await request.post(AUTH_SIGN_IN_URL, {
    data: {
      email,
      otp,
    },
  });

  if (response.status() !== 200) {
    const body = await readResponseBody(response);
    throw new Error(`OTP sign-in failed for ${email} (${response.status()}): ${body}`);
  }

  return { email, otp };
}

export async function getAuthenticatedStorageState(request: APIRequestContext, email: string) {
  await signInWithEmailOtp(request, email);

  const storageState = await request.storageState();
  if (storageState.cookies.length === 0) {
    throw new Error(`Expected auth cookies after sign-in for ${email}`);
  }

  return storageState;
}

export async function seedAuthenticatedBrowserContext(
  context: BrowserContext,
  request: APIRequestContext,
  email: string,
) {
  await context.clearCookies();

  const storageState = await getAuthenticatedStorageState(request, email);
  await context.addCookies(storageState.cookies);
}
