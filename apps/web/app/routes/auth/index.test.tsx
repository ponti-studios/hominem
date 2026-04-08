import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Component, { loader } from './index';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  emailOtpSendVerificationOtp: vi.fn(),
  passkeyAuthenticate: vi.fn(),
  getServerAuth: vi.fn(),
  useLocation: vi.fn(),
  useSearchParams: vi.fn(),
}));

function expectResponse(response: Response | null): Response {
  if (!(response instanceof Response)) {
    throw new Error('Expected a redirect response');
  }

  return response;
}

vi.mock('@hominem/auth/client', () => ({
  useAuthClient: () => ({
    emailOtp: {
      sendVerificationOtp: mocks.emailOtpSendVerificationOtp,
    },
  }),
  usePasskeyAuth: () => ({
    authenticate: mocks.passkeyAuthenticate,
    error: null,
    isSupported: true,
  }),
}));

vi.mock('~/lib/auth.server', () => ({
  getServerAuth: mocks.getServerAuth,
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');

  return {
    ...actual,
    useLocation: () => mocks.useLocation(),
    useNavigate: () => mocks.navigate,
    useNavigation: () => ({ state: 'idle', formAction: null }),
    useSearchParams: () => mocks.useSearchParams(),
  };
});

describe('/auth route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.emailOtpSendVerificationOtp.mockResolvedValue({ error: null });
    mocks.passkeyAuthenticate.mockResolvedValue(undefined);
    mocks.getServerAuth.mockResolvedValue({ user: null, headers: new Headers() });
    mocks.useLocation.mockReturnValue({ search: '?next=/chat/room-1' });
    mocks.useSearchParams.mockReturnValue([new URLSearchParams('next=/chat/room-1'), vi.fn()]);
  });

  it('redirects authenticated users to a safe destination', async () => {
    const headers = new Headers([['x-test', '1']]);
    mocks.getServerAuth.mockResolvedValue({
      user: { id: 'user-1' },
      headers,
    });

    const response = expectResponse(
      await loader({
        request: new Request('http://localhost/auth?next=https://evil.example/phish'),
      }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/home');
    expect(response.headers.get('x-test')).toBe('1');
  });

  it('sends the otp request and navigates to verify with normalized email', async () => {
    render(<Component />);

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: '  Person@Example.com ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(mocks.emailOtpSendVerificationOtp).toHaveBeenCalledWith({
        email: 'person@example.com',
        type: 'sign-in',
      });
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      '/auth/verify?email=person%40example.com&next=%2Fchat%2Froom-1',
    );
  });

  it('shows passkey callback errors from the url', () => {
    mocks.useLocation.mockReturnValue({ search: '?error=access_denied' });
    mocks.useSearchParams.mockReturnValue([new URLSearchParams(), vi.fn()]);

    render(<Component />);

    expect(screen.getByText('Access was denied.')).toBeInTheDocument();
  });

  it('runs passkey auth from the route wiring', async () => {
    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /use passkey/i }));

    await waitFor(() => {
      expect(mocks.passkeyAuthenticate).toHaveBeenCalledTimes(1);
    });
  });

  it('shows email otp request failures inline', async () => {
    mocks.emailOtpSendVerificationOtp.mockResolvedValue({
      error: { message: 'Rate limited' },
    });

    render(<Component />);

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'person@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Rate limited')).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
