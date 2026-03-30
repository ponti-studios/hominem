// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  bootstrapSessionMock,
  isPasskeySupportedMock,
  requestEmailOtpMock,
  signInWithPasskeyMock,
  signOutMock,
  verifyEmailOtpMock,
} = vi.hoisted(() => ({
  bootstrapSessionMock: vi.fn(),
  isPasskeySupportedMock: vi.fn(),
  requestEmailOtpMock: vi.fn(),
  signInWithPasskeyMock: vi.fn(),
  signOutMock: vi.fn(),
  verifyEmailOtpMock: vi.fn(),
}));

vi.mock('../lib/env', () => ({
  desktopEnv: {
    VITE_PUBLIC_API_URL: 'http://localhost:4040',
  },
}));

vi.mock('./session-client', () => ({
  bootstrapSession: bootstrapSessionMock,
  isPasskeySupported: isPasskeySupportedMock,
  requestEmailOtp: requestEmailOtpMock,
  signInWithPasskey: signInWithPasskeyMock,
  signOut: signOutMock,
  toUserFacingError: (error: unknown, fallback: string) =>
    error instanceof Error ? error : new Error(fallback),
  verifyEmailOtp: verifyEmailOtpMock,
}));

import { AuthGate } from './auth-gate';
import { DesktopAuthProvider } from './auth-provider';

const demoUser = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'User Example',
  createdAt: '2026-03-10T12:00:00.000Z',
  updatedAt: '2026-03-10T12:00:00.000Z',
};

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setInputValue(element: HTMLInputElement, value: string) {
  await act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
  });
}

describe('desktop auth journeys', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    bootstrapSessionMock.mockReset();
    isPasskeySupportedMock.mockReset();
    requestEmailOtpMock.mockReset();
    signInWithPasskeyMock.mockReset();
    signOutMock.mockReset();
    verifyEmailOtpMock.mockReset();

    isPasskeySupportedMock.mockReturnValue(true);

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        closeWindow: vi.fn(),
        isPackaged: vi.fn().mockResolvedValue(false),
        minimizeWindow: vi.fn(),
        platform: 'darwin',
      },
    });

    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await flush();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  async function renderAuthGate() {
    await act(async () => {
      root.render(
        <DesktopAuthProvider>
          <AuthGate />
        </DesktopAuthProvider>,
      );
      await flush();
    });
  }

  it('bootstraps directly into the authenticated desktop shell when a Better Auth session exists', async () => {
    bootstrapSessionMock.mockResolvedValueOnce({ user: demoUser });

    await renderAuthGate();

    expect(container.textContent).toContain('Desktop workspace');
    expect(container.textContent).toContain('Signed in as');
    expect(container.textContent).toContain('user@example.com');
  });

  it('completes the desktop email OTP journey into the authenticated shell', async () => {
    bootstrapSessionMock.mockResolvedValueOnce({ user: null });
    requestEmailOtpMock.mockResolvedValueOnce(undefined);
    verifyEmailOtpMock.mockResolvedValueOnce({ user: demoUser });

    await renderAuthGate();

    const emailInput = container.querySelector('#desktop-email') as HTMLInputElement | null;
    expect(emailInput).not.toBeNull();
    await setInputValue(emailInput!, 'desktop-auth@hominem.test');

    await act(async () => {
      emailInput!
        .closest('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();
    });

    expect(requestEmailOtpMock).toHaveBeenCalledWith(
      'http://localhost:4040',
      'desktop-auth@hominem.test',
    );
    expect(container.textContent).toContain('Verification code');
    expect(container.textContent).toContain('desktop-auth@hominem.test');

    const otpInput = container.querySelector('#desktop-otp') as HTMLInputElement | null;
    expect(otpInput).not.toBeNull();
    await setInputValue(otpInput!, '123456');

    await act(async () => {
      otpInput!
        .closest('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();
    });

    expect(verifyEmailOtpMock).toHaveBeenCalledWith(
      'http://localhost:4040',
      'desktop-auth@hominem.test',
      '123456',
    );
    expect(container.textContent).toContain('Desktop workspace');
    expect(container.textContent).toContain('user@example.com');
  });

  it('completes desktop passkey sign-in into the authenticated shell', async () => {
    bootstrapSessionMock.mockResolvedValueOnce({ user: null });
    signInWithPasskeyMock.mockResolvedValueOnce({ user: demoUser });

    await renderAuthGate();

    const passkeyButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Use a passkey'),
    );
    expect(passkeyButton).toBeDefined();

    await act(async () => {
      passkeyButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
    });

    expect(signInWithPasskeyMock).toHaveBeenCalledWith('http://localhost:4040');
    expect(container.textContent).toContain('Desktop workspace');
    expect(container.textContent).toContain('user@example.com');
  });

  it('returns to the desktop auth gate after sign-out', async () => {
    bootstrapSessionMock.mockResolvedValueOnce({ user: demoUser });
    signOutMock.mockResolvedValueOnce(undefined);

    await renderAuthGate();

    const signOutButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Sign out'),
    );
    expect(signOutButton).toBeDefined();

    await act(async () => {
      signOutButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
    });

    expect(signOutMock).toHaveBeenCalledWith('http://localhost:4040');
    expect(container.textContent).toContain('Sign in to continue');
    expect(container.querySelector('#desktop-email')).not.toBeNull();
  });
});
