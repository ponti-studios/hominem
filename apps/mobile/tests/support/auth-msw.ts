import { delay, http, HttpResponse } from 'msw';

function authRoute(path: string) {
  return new URL(path, 'http://localhost:4040').toString();
}

export function mockAuthBootSignedIn(input?: { email?: string; id?: string; cookie?: string }) {
  const email = input?.email ?? 'mobile-user@hominem.test';
  const id = input?.id ?? 'user-mobile-1';
  const cookie = input?.cookie ?? 'better-auth.session_token=session-token';

  return http.get(authRoute('/api/auth/get-session'), async () => {
    return HttpResponse.json(
      {
        session: {
          id: 'session-1',
          token: 'session-token',
          userId: id,
          expiresAt: new Date('2030-01-01T00:00:00.000Z').toISOString(),
          createdAt: new Date('2029-01-01T00:00:00.000Z').toISOString(),
          updatedAt: new Date('2029-01-01T00:00:00.000Z').toISOString(),
        },
        user: {
          id,
          email,
          name: 'Mobile User',
          image: null,
          emailVerified: false,
          createdAt: new Date('2029-01-01T00:00:00.000Z').toISOString(),
          updatedAt: new Date('2029-01-01T00:00:00.000Z').toISOString(),
        },
      },
      {
        headers: {
          'set-cookie': cookie,
        },
      },
    );
  });
}

export function mockAuthBootSignedOut() {
  return http.get(authRoute('/api/auth/get-session'), async () => {
    return new HttpResponse(null, { status: 401 });
  });
}

export function mockSendVerificationOtpSuccess() {
  return http.post(authRoute('/api/auth/email-otp/send-verification-otp'), async () => {
    return HttpResponse.json({ ok: true });
  });
}

export function mockSendVerificationOtpError(message = 'Unable to send verification code.') {
  return http.post(authRoute('/api/auth/email-otp/send-verification-otp'), async () => {
    return HttpResponse.json({ message }, { status: 400 });
  });
}

function mockSendVerificationOtpTimeout() {
  return http.post(authRoute('/api/auth/email-otp/send-verification-otp'), async () => {
    await delay('infinite');
    return HttpResponse.json({ ok: true });
  });
}

export function mockVerifyEmailOtpSuccess(input?: {
  email?: string;
  id?: string;
  cookie?: string;
}) {
  const email = input?.email ?? 'mobile-user@hominem.test';
  const id = input?.id ?? 'user-mobile-1';
  const cookie = input?.cookie ?? 'better-auth.session_token=session-token';

  return http.post(authRoute('/api/auth/sign-in/email-otp'), async () => {
    return HttpResponse.json(
      {
        user: {
          id,
          email,
          name: 'Mobile User',
        },
      },
      {
        headers: {
          'set-cookie': cookie,
        },
      },
    );
  });
}

export function mockVerifyEmailOtpError(message = 'Verification failed. Please try again.') {
  return http.post(authRoute('/api/auth/sign-in/email-otp'), async () => {
    return HttpResponse.json({ message }, { status: 400 });
  });
}

function mockVerifyEmailOtpTimeout() {
  return http.post(authRoute('/api/auth/sign-in/email-otp'), async () => {
    await delay('infinite');
    return HttpResponse.json({ ok: true });
  });
}

export function mockSignOutSuccess() {
  return http.post(authRoute('/api/auth/sign-out'), async () => {
    return HttpResponse.json({ success: true });
  });
}

export function mockSignOutError(message = 'Failed to sign out. Please try again.') {
  return http.post(authRoute('/api/auth/sign-out'), async () => {
    return HttpResponse.json({ message }, { status: 400 });
  });
}
